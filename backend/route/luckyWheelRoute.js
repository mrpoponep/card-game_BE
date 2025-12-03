import express from 'express';

const router = express.Router();

// Tạm thời trả về array rỗng cho history vì chưa có implementation
router.get('/history', (req, res) => {
  return res.status(200).json({
    success: true,
    data: []
  });
});

export default router;
