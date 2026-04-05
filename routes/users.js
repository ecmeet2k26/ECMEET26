const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const User = require('../models/User');
const StudentData = require('../models/StudentData');
const ExcelJS = require('exceljs');

// ─── Get My Profile ────────────────────────────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
  const user = req.user;
  res.json({
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      profilePicture: user.profilePicture,
      role: user.role,
      team: user.team,
      rrn: user.rrn,
      department: user.department,
      class: user.class,
      section: user.section,
      contactNumber: user.contactNumber,
      houseRevealed: user.houseRevealed,
      sortingCombo: user.sortingCombo
    }
  });
});

// ─── Update Profile ────────────────────────────────────────────────────────────
router.patch('/me', authenticate, async (req, res) => {
  try {
    const allowed = ['name', 'profilePicture', 'contactNumber', 'sortingCombo'];
    const updates = {};
    allowed.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: 'Update failed' });
  }
});

// ─── Reveal House ──────────────────────────────────────────────────────────────
router.post('/reveal-house', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.team) {
      return res.status(400).json({
        error: 'NO_TEAM',
        message: 'No team assigned to your account. Please contact admin or re-import student data.'
      });
    }

    const updates = { houseRevealed: true };
    
    // If frontend sends a combo and we don't have one, save it
    if (req.body.sortingCombo && !user.sortingCombo) {
      updates.sortingCombo = req.body.sortingCombo;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id, 
      updates, 
      { new: true }
    );

    res.json({
      success: true,
      alreadyRevealed: user.houseRevealed,
      team: user.team,
      sortingCombo: updatedUser.sortingCombo,
      message: `Welcome to ${user.team}!`
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reveal house' });
  }
});

// ─── Download Team Members (Excel) ─────────────────────────────────────────────
router.get('/members/download', authenticate, async (req, res) => {
  try {
    const user = req.user;
    if (!user.team) return res.status(400).json({ error: 'No house assigned' });

    // Fetch students in this team, sorted by dept
    const students = await StudentData.find({ team: user.team }).sort({ dept: 1, studentName: 1 });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`${user.team} Members`);

    // Define columns
    worksheet.columns = [
      { header: 'S.No', key: 'sno', width: 8 },
      { header: 'Student Name', key: 'name', width: 30 },
      { header: 'RRN', key: 'rrn', width: 20 },
      { header: 'Department', key: 'dept', width: 25 },
      { header: 'Year', key: 'year', width: 12 },
      { header: 'Section', key: 'section', width: 10 }
    ];

    // House-specific styling (optional - using gold for general ECMEET branding)
    const headerColor = '1A1A1A'; // Deep Black
    const textColor = 'C9A84C';   // Gold
    
    // Add data
    students.forEach((s, i) => {
      worksheet.addRow({
        sno: i + 1,
        name: s.studentName,
        rrn: s.rrn,
        dept: s.dept,
        year: s.year,
        section: s.section
      });
    });

    // Styling: Headers
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: headerColor }
      };
      cell.font = {
        name: 'Segoe UI',
        bold: true,
        color: { argb: 'FFFFFF' }, // White text on black
        size: 11
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thick' },
        right: { style: 'thin' }
      };
    });
    headerRow.height = 30;

    // Styling: Data Rows
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Segoe UI', size: 10 };
        cell.alignment = { vertical: 'middle' };
        
        // Center S.No, RRN, Year, Section
        if ([1, 3, 5, 6].includes(colNumber)) {
          cell.alignment.horizontal = 'center';
        }

        cell.border = {
          top: { style: 'thin', color: { argb: 'E2E2E2' } },
          left: { style: 'thin', color: { argb: 'E2E2E2' } },
          bottom: { style: 'thin', color: { argb: 'E2E2E2' } },
          right: { style: 'thin', color: { argb: 'E2E2E2' } }
        };

        // Zebra Striping
        if (rowNumber % 2 === 0) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'F9F9F9' }
          };
        }
      });
      row.height = 25;
    });

    // Auto-adjust column widths based on content (Manual implementation)
    worksheet.columns.forEach(column => {
      let maxLen = column.header.length;
      column.eachCell({ includeEmpty: false }, cell => {
        const cellValue = cell.value ? cell.value.toString() : '';
        maxLen = Math.max(maxLen, cellValue.length);
      });
      column.width = Math.min(Math.max(maxLen + 4, column.width || 10), 50);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="ECMEET26_${user.team}_Members.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: 'Failed to generate excel file' });
  }
});

module.exports = router;
