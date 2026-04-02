const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const User = require('../models/User');
const Registration = require('../models/Registration');
const StudentData = require('../models/StudentData');
const Event = require('../models/Event');
const XLSX = require('xlsx');
const CONFIG = require('../config/events.config');
const socketIO = require('../utils/socket');

// ─── Get All Registrations (Admin/Dev/Captain) ──────────────────────────────────
router.get('/registrations', authenticate, requireRole('admin', 'dev', 'captain'), async (req, res) => {
  try {
    const { eventId } = req.query;
    const filter = eventId ? { eventId } : {};
    
    // Captains only see their own house
    if (req.user.role === 'captain') {
      filter.team = req.user.team;
    }

    const registrations = await Registration.find(filter).sort({ createdAt: -1 });
    res.json({ registrations, count: registrations.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

// ─── Coordinator: Get Their Event Registrations ────────────────────────────────
router.get('/coordinator/registrations', authenticate, requireRole('coordinator', 'admin', 'dev'), async (req, res) => {
  try {
    // Check dynamic assignment first, fallback to static config
    let eventIds = req.user.assignedEvents || [];
    if (eventIds.length === 0) {
      const coord = CONFIG.coordinators.find(c => c.email === req.user.email);
      if (coord) eventIds = coord.assignedEvents;
    }

    const registrations = await Registration.find({
      eventId: { $in: eventIds }
    }).sort({ createdAt: -1 });

    res.json({ registrations, assignedEvents: eventIds });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

// ─── Download Excel: All or By Event ──────────────────────────────────────────
router.get('/download/registrations', authenticate, requireRole('coordinator', 'admin', 'dev', 'captain'), async (req, res) => {
  try {
    const { eventId } = req.query;
    let filter = eventId ? { eventId } : {};
    
    if (req.user.role === 'captain') {
      filter.team = req.user.team;
    } else if (req.user.role === 'coordinator') {
      let eventIds = req.user.assignedEvents || [];
      if (eventIds.length === 0) {
        const coord = (CONFIG.coordinators || []).find(c => c.email === req.user.email);
        if (coord) eventIds = coord.assignedEvents || [];
      }
      
      if (eventId) {
        if (!eventIds.includes(eventId)) {
          return res.status(403).json({ error: 'Unauthorized: You are not a coordinator for this event' });
        }
      } else {
        filter.eventId = { $in: eventIds };
      }
    }

    const registrations = await Registration.find(filter).sort({ eventId: 1, createdAt: 1 });

    const data = registrations.map((r, i) => ({
      'S.No': i + 1,
      'Name': r.name,
      'Email': r.email,
      'RRN': r.rrn || '',
      'Team/House': r.team || '',
      'Department': r.department || '',
      'Section': r.section || '',
      'Contact': r.contactNumber || '',
      'Event': r.eventName,
      'Status': r.status,
      'Registered At': new Date(r.createdAt).toLocaleString('en-IN')
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    
    // Auto-size columns
    const colWidths = Object.keys(data[0] || {}).map(key => {
      const headerLen = key.length;
      const maxDataLen = data.reduce((max, row) => {
        const val = row[key] ? row[key].toString().length : 0;
        return val > max ? val : max;
      }, 0);
      return { wch: Math.max(headerLen, maxDataLen) + 2 };
    });
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Registrations');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    let filename = 'ECMEET26_Events_reg.xlsx';
    if (eventId && registrations.length > 0) {
      const eventName = registrations[0].eventName.replace(/[^a-z0-9]/gi, '_');
      filename = `ECMEET26_${eventName}_reg.xlsx`;
    }

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: 'Export failed' });
  }
});

// ─── Get All Users (Admin/Dev/Captain/Coordinator) ─────────────────────────────
router.get('/users', authenticate, requireRole('admin', 'dev', 'captain', 'coordinator'), async (req, res) => {
  try {
    const { search, team, department, year: yearName, section, mode, sortBy } = req.query;
    
    // Scoping for Captains (only applies to students mode, staff mode shows all)
    const houseFilter = (req.user.role === 'captain' && mode !== 'staff') 
      ? req.user.team 
      : (team && team !== 'all' ? team : null);

    // Filter for StudentData (The Master List)
    const studentMatch = {};
    if (houseFilter) studentMatch.team = houseFilter;
    if (department && department !== 'all') studentMatch.dept = new RegExp(department, 'i');
    if (section && section !== 'all') studentMatch.section = section;
    
    // Smart Filter: Split "AI&DS 2nd year"
    if (yearName && yearName !== 'all') {
      const parts = yearName.split(' ');
      const deptPart = parts[0]; // e.g., "AI&DS"
      const yearPart = parts[1]; // e.g., "2nd"
      studentMatch.dept = new RegExp(deptPart, 'i');
      studentMatch.year = new RegExp(yearPart, 'i');
    }

    if (search) {
      studentMatch.$or = [
        { studentName: new RegExp(search, 'i') },
        { emailId: new RegExp(search, 'i') },
        { rrn: new RegExp(search, 'i') }
      ];
    }

    // Step 1: Get all Students (from StudentData) joined with User & Registration
    let studentRecords = [];
    if (!mode || mode === 'students') {
      const studentRecordsData = await StudentData.aggregate([
      { $match: studentMatch },
      {
        $lookup: {
          from: 'users',
          localField: 'emailId',
          foreignField: 'email',
          as: 'loginData'
        }
      },
      { $unwind: { path: '$loginData', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'registrations',
          localField: 'rrn',
          foreignField: 'rrn',
          as: 'eventData'
        }
      },
      {
        $project: {
          _id: { $ifNull: ["$loginData._id", "$_id"] }, // Prefer User ID if exist
          email: "$emailId",
          name: "$studentName",
          profilePicture: { $ifNull: ["$loginData.profilePicture", "$profilePicture"] },
          rrn: 1,
          team: 1,
          department: "$dept",
          year: 1,
          section: 1,
          contactNumber: { $ifNull: ["$loginData.contactNumber", "$contactNumber"] },
          role: { $ifNull: ["$loginData.role", "student"] },
          hasLoggedIn: { $cond: [{ $ifNull: ["$loginData.googleId", false] }, true, false] },
          houseRevealed: { $ifNull: ["$loginData.houseRevealed", false] },
          lastLogin: "$loginData.lastLogin",
          isOnline: "$loginData.isOnline",
          registrationCount: { 
            $size: { 
              $filter: { 
                input: "$eventData", 
                as: "r", 
                cond: { $ne: ["$$r.status", "cancelled"] } 
              } 
            } 
          },
          eventNames: {
            $map: {
              input: { 
                $filter: { 
                  input: "$eventData", 
                  as: "r", 
                  cond: { $ne: ["$$r.status", "cancelled"] } 
                } 
              },
              as: "reg",
              in: "$$reg.eventName"
            }
          }
        }
      }
      ]);
      studentRecords = studentRecordsData;
    }

    // Step 2: Get Staff (Admin, Dev, etc.) who aren't in StudentData
    let staffRecords = [];
    if (!mode || mode === 'staff') {
      // If mode is staff, we don't care about department/year filters usually, 
      // but we apply them if they are passed.
      const staffFilter = { role: { $ne: 'student' } };
      if (houseFilter) staffFilter.team = houseFilter;
      if (search) {
        staffFilter.$or = [
          { name: new RegExp(search, 'i') },
          { email: new RegExp(search, 'i') }
        ];
      }
      
      staffRecords = await User.aggregate([
        { $match: staffFilter },
        {
          $lookup: {
            from: 'registrations',
            let: { assigned: "$assignedEvents" },
            pipeline: [
              { $match: { 
                  $expr: { 
                    $anyElementTrue: {
                      $map: {
                        input: { $ifNull: ["$$assigned", []] },
                        as: "a",
                        in: {
                          $regexMatch: {
                            input: "$eventName",
                            regex: { $replaceAll: { input: "$$a", find: "_", replacement: " " } },
                            options: "i"
                          }
                        }
                      }
                    }
                  },
                  status: { $ne: 'cancelled' }
              } },
              { $count: "total" }
            ],
            as: 'totalEventStats'
          }
        },
        {
          $project: {
            email: 1, name: 1, profilePicture: 1, role: 1, lastLogin: 1, isOnline: 1,
            team: 1, department: 1, year: 1, section: 1, rrn: 1,
            assignedEvents: 1,
            hasLoggedIn: { $cond: [{ $ifNull: ["$googleId", false] }, true, false] },
            totalAssignedRegistrations: { $ifNull: [{ $arrayElemAt: ["$totalEventStats.total", 0] }, 0] },
          }
        }
      ]);
    }

    // Step 3: Combine & Deduplicate by Email (Staff records override static Student records)
    const combined = new Map();
    [...studentRecords, ...staffRecords].forEach(u => {
      if (!u.email) return;
      const email = u.email.toLowerCase();
      const existing = combined.get(email);
      if (existing) {
        // Merge preferring staff data (role !== student)
        combined.set(email, { ...existing, ...u });
      } else {
        combined.set(email, u);
      }
    });

    const allUsers = Array.from(combined.values()).sort((a,b) => {
      if (mode === 'staff') return 0; // maintain default sort for staff

      switch (sortBy) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'rrn':
          return (a.rrn || '').localeCompare(b.rrn || '');
        case 'team': {
          const teamComp = (a.team || '').localeCompare(b.team || '');
          if (teamComp !== 0) return teamComp;
          return (a.rrn || '').localeCompare(b.rrn || '');
        }
        case 'event': {
          const aCount = a.registrationCount ?? a.totalAssignedRegistrations ?? 0;
          const bCount = b.registrationCount ?? b.totalAssignedRegistrations ?? 0;
          return bCount - aCount;
        }
        case 'reveal':
          return (b.houseRevealed ? 1 : 0) - (a.houseRevealed ? 1 : 0);
        default:
          return (b.hasLoggedIn ? 1 : 0) - (a.hasLoggedIn ? 1 : 0);
      }
    });

    console.log(`[GET /users] mode=${mode} search=${search} team=${team} count=${allUsers.length}`);
    res.json({ users: allUsers, count: allUsers.length });
  } catch (err) {
    console.error('Users fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch unified user list' });
  }
});

// ─── Download Users Excel ─────────────────────────────────────────────────────
router.get('/download/users', authenticate, requireRole('admin', 'dev', 'captain'), async (req, res) => {
  try {
    const { team, department, year: yearName, section, mode } = req.query;
    
    // Scoping for Captains (only applies to students mode, staff mode shows all)
    const houseFilter = (req.user.role === 'captain' && mode !== 'staff') 
      ? req.user.team 
      : (team && team !== 'all' ? team : null);

    const studentMatch = {};
    if (houseFilter) studentMatch.team = houseFilter;
    if (department && department !== 'all') studentMatch.dept = new RegExp(department, 'i');
    if (section && section !== 'all') studentMatch.section = section;
    
    if (yearName && yearName !== 'all') {
      const parts = yearName.split(' ');
      studentMatch.dept = new RegExp(parts[0], 'i');
      studentMatch.year = new RegExp(parts[1], 'i');
    }

    const students = await StudentData.find(studentMatch).sort({ team: 1, studentName: 1 });

    const data = students.map((s, i) => ({
      'S.No': i + 1,
      'Student Name': s.studentName,
      'RRN': s.rrn,
      'Email': s.emailId,
      'House': s.team,
      'Year': s.year,
      'Department': s.dept,
      'Section': s.section
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    
    // Auto-size columns
    const colWidths = Object.keys(data[0] || {}).map(key => {
      const headerLen = key.length;
      const maxDataLen = data.reduce((max, row) => {
        const val = row[key] ? row[key].toString().length : 0;
        return val > max ? val : max;
      }, 0);
      return { wch: Math.max(headerLen, maxDataLen) + 2 };
    });
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Dynamic Filename
    let filenameParts = ['ECMEET26'];
    if (team && team !== 'all') filenameParts.push(team);
    if (department && department !== 'all') filenameParts.push(department);
    if (section && section !== 'all') filenameParts.push(section);
    filenameParts.push('Students_list');
    const filename = filenameParts.map(s => s.replace(/[^a-z0-9]/gi, '_')).join('_') + '.xlsx';

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: 'Export failed' });
  }
});

// ─── Dev: Delete Student ───────────────────────────────────────────────────────
router.delete('/students/:rrn', authenticate, requireRole('dev'), async (req, res) => {
  try {
    const { rrn } = req.params;
    const student = await StudentData.findOneAndDelete({ rrn });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    await User.findOneAndUpdate({ email: student.emailId }, { $set: { role: 'student' } });
    
    socketIO.getIO().emit('data-updated', { type: 'STUDENT_DELETED', rrn });
    
    res.json({ success: true, message: 'Student deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

// ─── Dev: Update Student ───────────────────────────────────────────────────────
router.patch('/students/:rrn', authenticate, requireRole('dev'), async (req, res) => {
  try {
    const { rrn } = req.params;
    const body = req.body;
    
    // Map common frontend fields to backend schema
    const updateData = { ...body };
    if (body.name) {
      updateData.studentName = body.name;
      delete updateData.name;
    }

    const { newRrn } = body;
    if (newRrn) {
      updateData.rrn = newRrn;
      delete updateData.newRrn;
    }

    const student = await StudentData.findOneAndUpdate({ rrn }, { $set: updateData }, { new: true });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    // Handle cascade updates
    const userUpdate = {};
    if (updateData.studentName) userUpdate.name = updateData.studentName;
    if (updateData.team) userUpdate.team = updateData.team;
    
    if (Object.keys(userUpdate).length > 0) {
      await User.findOneAndUpdate({ email: student.emailId }, { $set: userUpdate });
    }

    // Handle RRN update cascade
    if (newRrn && newRrn !== rrn) {
      await Registration.updateMany({ rrn }, { $set: { rrn: newRrn } });
    }

    socketIO.getIO().emit('data-updated', { type: 'STUDENT_UPDATED', rrn: newRrn || rrn });

    res.json({ success: true, student });
  } catch (err) {
    console.error('Update student error:', err);
    res.status(500).json({ error: 'Failed to update student' });
  }
});

// ─── Upload Student Excel ──────────────────────────────────────────────────────
router.post('/upload-students', authenticate, requireRole('dev'), async (req, res) => {
  try {
    const { students } = req.body;
    if (!Array.isArray(students)) return res.status(400).json({ error: 'Invalid data' });

    const normalizeTeam = (t) => {
      if (!t) return '';
      const clean = String(t).trim().toLowerCase();
      const map = { 'gryffindor': 'Gryffindor', 'slytherin': 'Slytherin', 'ravenclaw': 'Ravenclaw', 'hufflepuff': 'Hufflepuff' };
      return map[clean] || (clean.charAt(0).toUpperCase() + clean.slice(1));
    };

    let inserted = 0, updated = 0;
    for (const s of students) {
      const normalizedTeam = normalizeTeam(s.team);
      await StudentData.findOneAndUpdate(
        { emailId: s.emailId?.toLowerCase() },
        {
          studentName: s.studentName,
          rrn: s.rrn,
          emailId: s.emailId?.toLowerCase(),
          team: normalizedTeam,
          dept: s.dept,
          year: s.year,
          section: s.section,
          contactNumber: s.contactNumber
        },
        { upsert: true, new: true }
      );
      inserted++;
    }

    socketIO.getIO().emit('data-updated', { type: 'STUDENTS_UPLOADED', count: inserted });

    res.json({ success: true, processed: inserted });
  } catch (err) {
    res.status(500).json({ error: 'Upload failed', message: err.message });
  }
});

// ─── Dev: Add User By Email ───────────────────────────────────────────────────
router.post('/add-user', authenticate, requireRole('dev'), async (req, res) => {
  try {
    let { email, role, name, team, assignedEvents } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    email = email.toLowerCase().trim();

    if (!['student', 'coordinator', 'captain', 'admin', 'dev'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (role === 'admin' && email !== 'zzayir21@gmail.com') {
      role = 'student';
    }

    const updateData = {
      role,
      name: name || email.split('@')[0],
      assignedEvents: role === 'coordinator' && Array.isArray(assignedEvents) ? assignedEvents : [],
      team: role === 'captain' && team ? team : undefined,
      isActive: true
    };

    // Auto-populate from StudentData if fields are missing
    const studentInfo = await StudentData.findOne({ emailId: email });
    if (studentInfo) {
      updateData.rrn = studentInfo.rrn;
      if (!name) updateData.name = studentInfo.studentName;
      if (!team && studentInfo.team) updateData.team = studentInfo.team;
      updateData.department = studentInfo.dept;
      updateData.year = studentInfo.year;
      updateData.section = studentInfo.section;
    }

    const user = await User.findOneAndUpdate(
      { email },
      { $set: updateData },
      { new: true, upsert: true }
    );
    console.log(`[POST /add-user] Account ${email} set to role ${role}`);

    socketIO.getIO().emit('data-updated', { type: 'USER_ADDED', email });

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add user' });
  }
});

// ─── Dev: Modify User Role ─────────────────────────────────────────────────────
// ─── Dev: Modify User Role ─────────────────────────────────────────────────────
router.patch('/users/:id/role', authenticate, requireRole('dev'), async (req, res) => {
  try {
    let { role, assignedEvents, team } = req.body;
    if (!['student', 'coordinator', 'captain', 'admin', 'dev'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    // Hardcoded Dev check
    if (targetUser._id.toString() === '69c00eaad6f980392310b1c8') {
      role = 'dev'; // Force dev for this specific ID
    }

    // Admin email check (silently fallback to student if not allowed)
    if (role === 'admin' && targetUser.email !== 'zzayir21@gmail.com') {
      role = 'student';
    }

    // Prepare update payload
    const updateData = { role };
    if (role === 'coordinator' && Array.isArray(assignedEvents)) {
      updateData.assignedEvents = assignedEvents;
    } else {
      updateData.assignedEvents = []; // clean up if changed away from coordinator
    }

    if (role === 'captain' && team) {
      updateData.team = team;
    }

    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true });
    
    socketIO.getIO().emit('data-updated', { type: 'USER_ROLE_UPDATED', userId: req.params.id });
    
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// ─── Dev: Password Check ───────────────────────────────────────────────────────
router.post('/dev/verify', (req, res) => {
  const { password } = req.body;
  const devPassword = process.env.DEV_PASSWORD || '2112';
  if (password === devPassword) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid dev password' });
  }
});

// ─── Dev: Event Management (MongoDB) ──────────────────────────────────────────

// Add Event
router.post('/events', authenticate, requireRole('dev'), async (req, res) => {
  try {
    const { id, name, category, description, venue, date, time, teamSize, maxParticipants, coordinator } = req.body;
    if (!id || !name) return res.status(400).json({ error: 'id and name are required' });
    
    const existing = await Event.findOne({ id });
    if (existing) return res.status(409).json({ error: 'Event ID already exists' });
    
    const count = await Event.countDocuments();
    const newEvent = await Event.create({ 
      id, name, category: category || 'Cultural', description: description || '', 
      maxParticipants: maxParticipants || 100, teamSize: teamSize || '1', 
      venue: venue || '', date: date || '', time: time || '', rules: [], 
      coordinator: coordinator || {}, order: count 
    });
    
    socketIO.getIO().emit('data-updated', { type: 'EVENT_ADDED', eventId: id });
    res.json({ success: true, event: newEvent });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add event', message: err.message });
  }
});

// Update Event
router.put('/events/:id', authenticate, requireRole('dev'), async (req, res) => {
  try {
    const event = await Event.findOneAndUpdate(
      { id: req.params.id }, 
      { $set: req.body }, 
      { new: true }
    );
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    socketIO.getIO().emit('data-updated', { type: 'EVENT_UPDATED', eventId: req.params.id });
    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update event', message: err.message });
  }
});

// Delete Event
router.delete('/events/:id', authenticate, requireRole('dev'), async (req, res) => {
  try {
    const event = await Event.findOneAndDelete({ id: req.params.id });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    socketIO.getIO().emit('data-updated', { type: 'EVENT_DELETED', eventId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete event', message: err.message });
  }
});

// Publish / Confirm 
router.post('/events/publish', authenticate, requireRole('dev'), async (req, res) => {
  const events = await Event.find().sort({ order: 1 });
  res.json({ success: true, count: events.length, events: events.map(e => ({ id: e.id, name: e.name })) });
});

// Toggle Registration Open/Closed per Event
router.put('/events/:id/registration', authenticate, requireRole('dev'), async (req, res) => {
  try {
    const event = await Event.findOne({ id: req.params.id });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    event.registrationOpen = !event.registrationOpen;
    await event.save();
    
    socketIO.getIO().emit('data-updated', { type: 'EVENT_REG_TOGGLED', eventId: req.params.id });
    res.json({ success: true, registrationOpen: event.registrationOpen });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle registration', message: err.message });
  }
});

// Reorder Events
router.put('/events-order', authenticate, requireRole('dev'), async (req, res) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'orderedIds must be an array' });
    
    const ops = orderedIds.map((id, index) => ({
      updateOne: {
        filter: { id },
        update: { $set: { order: index } }
      }
    }));
    
    await Event.bulkWrite(ops);
    
    socketIO.getIO().emit('data-updated', { type: 'EVENTS_REORDERED' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reorder events', message: err.message });
  }
});

module.exports = router;
