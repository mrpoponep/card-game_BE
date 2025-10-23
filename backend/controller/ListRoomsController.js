import ListRoomService from "../service/ListRoomService.js";
/**
 * 🌟 API Handler: Lấy danh sách các phòng
 * Query param: ?type=private (default là public)
 */
export const getRoomList = async (req, res) => {
  try {
    // Đọc query parameter 'type'
    // Nếu req.query.type === 'private', thì isPrivate = true
    // Ngược lại (undefined, 'public', ...), thì isPrivate = false
    const isPrivate = req.query.type === 'private';
    
    // Gọi hàm model
    const tables = await ListRoomService.getTableList(isPrivate);

    // Trả về JSON
    res.json({
      success: true,
      type: isPrivate ? 'private' : 'public',
      count: tables.length,
      tables: tables
    });

  }
    catch (err) {
        console.error('Error in getRoomList:', err);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const getTableMetrics = async (req, res) => {
  try {
    // Gọi service mới
    const metrics = await ListRoomService.getMetrics();
    
    res.json({
      success: true,
      ...metrics // Trả về { success: true, totalTables: 5, ... }
    });
  } catch (err) {
    console.error('Error in getTableMetrics:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
  }
};