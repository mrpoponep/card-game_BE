// controller/tableController.js
import TableConfig from '../model/TableConfig.js';
import User from '../model/User.js';

/**
 * Lấy danh sách bàn public theo level
 * GET /api/tables/list?level=beginner
 */
export const getPublicTables = async (req, res) => {
    try {
        const { level = 'all' } = req.query;

        // Map level sang range min_buy_in
        const levelRanges = {
            'beginner': { min: 0, max: 5000 },       // Tập Sự: <= 5K
            'amateur': { min: 5001, max: 10000 },    // Nghiệp Dư: 5K-10K
            'pro': { min: 10001, max: 20000 },       // Chuyên Nghiệp: 10K-20K
            'master': { min: 20001, max: 999999 }    // Master: > 20K
        };

        let tables;
        if (level === 'all') {
            tables = await TableConfig.getAllPublicTables();
        } else {
            const range = levelRanges[level];
            if (!range) {
                return res.status(400).json({
                    success: false,
                    message: 'Level không hợp lệ. Chọn: beginner, amateur, pro, master, all'
                });
            }
            tables = await TableConfig.getTablesByBuyInRange(range.min, range.max);
        }

        // Format response với thông tin đầy đủ
        const formattedTables = tables.map(table => ({
            tableId: table.table_id,
            roomCode: table.room_code,
            level: getLevelName(table.min_buy_in),
            betLevel: formatBetLevel(table.small_blind),
            minBuyIn: table.min_buy_in,
            maxBuyIn: table.max_buy_in,
            currentPlayers: table.current_players || 0,
            maxPlayers: table.max_players,
            status: table.status,
            smallBlind: table.small_blind,
            maxBlind: table.max_blind,
            rake: table.rake,
            isPrivate: table.is_private
        }));

        res.json({
            success: true,
            tables: formattedTables,
            count: formattedTables.length
        });

    } catch (error) {
        console.error('Error fetching public tables:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách bàn chơi'
        });
    }
};

/**
 * Tham gia bàn chơi
 * POST /api/tables/join
 */
export const joinTable = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { roomCode, buyInAmount } = req.body;

        if (!roomCode) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu mã phòng'
            });
        }

        // 1. Lấy thông tin bàn
        const table = await TableConfig.getByRoomCode(roomCode);
        if (!table) {
            return res.status(404).json({
                success: false,
                message: 'Bàn chơi không tồn tại'
            });
        }

        // 2. Kiểm tra bàn có phải public
        if (table.is_private) {
            return res.status(403).json({
                success: false,
                message: 'Bàn này là private, cần mã mời'
            });
        }

        // 3. Kiểm tra bàn đã đầy
        const currentPlayers = table.current_players || 0;
        if (currentPlayers >= table.max_players) {
            return res.status(400).json({
                success: false,
                message: 'Bàn chơi đã đầy'
            });
        }

        // 4. Lấy thông tin user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Người chơi không tồn tại'
            });
        }

        // 5. Kiểm tra số dư
        const buyIn = buyInAmount || table.min_buy_in;
        if (buyIn < table.min_buy_in || buyIn > table.max_buy_in) {
            return res.status(400).json({
                success: false,
                message: `Buy-in phải từ ${table.min_buy_in} đến ${table.max_buy_in}`
            });
        }

        if (user.balance < buyIn) {
            return res.status(400).json({
                success: false,
                message: `Số dư không đủ. Cần ${buyIn}, có ${user.balance}`
            });
        }

        // 6. Trả về thông tin để client kết nối socket
        res.json({
            success: true,
            message: 'Tham gia bàn thành công',
            data: {
                roomCode: table.room_code,
                tableId: table.table_id,
                buyIn: buyIn,
                userBalance: user.balance,
                tableInfo: {
                    smallBlind: table.small_blind,
                    maxBlind: table.max_blind,
                    maxPlayers: table.max_players,
                    currentPlayers: currentPlayers
                }
            }
        });

        // Socket.io sẽ xử lý việc join room và trừ tiền sau khi user connect

    } catch (error) {
        console.error('Error joining table:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tham gia bàn chơi'
        });
    }
};

/**
 * Tạo bàn chơi mới (public)
 * POST /api/tables/create
 */
export const createTable = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { level, maxPlayers = 6 } = req.body;

        // Config theo level
        const levelConfigs = {
            'beginner': { minBuyIn: 2000, maxBuyIn: 5000, smallBlind: 10, maxBlind: 20 },
            'amateur': { minBuyIn: 5000, maxBuyIn: 10000, smallBlind: 25, maxBlind: 50 },
            'pro': { minBuyIn: 10000, maxBuyIn: 20000, smallBlind: 50, maxBlind: 100 },
            'master': { minBuyIn: 20000, maxBuyIn: 50000, smallBlind: 100, maxBlind: 200 }
        };

        const config = levelConfigs[level];
        if (!config) {
            return res.status(400).json({
                success: false,
                message: 'Level không hợp lệ'
            });
        }

        // Tạo room code unique (4 chữ số)
        let roomCode;
        let attempts = 0;
        do {
            roomCode = Math.floor(1000 + Math.random() * 9000).toString();
            const existing = await TableConfig.getByRoomCode(roomCode);
            if (!existing) break;
            attempts++;
        } while (attempts < 10);

        if (attempts >= 10) {
            return res.status(500).json({
                success: false,
                message: 'Không thể tạo mã phòng unique'
            });
        }

        // Tạo bàn mới
        const newTable = {
            room_code: roomCode,
            min_players: 2,
            max_players: maxPlayers,
            small_blind: config.smallBlind,
            max_blind: config.maxBlind,
            min_buy_in: config.minBuyIn,
            max_buy_in: config.maxBuyIn,
            rake: 0.05,
            is_private: false,
            status: 'waiting',
            created_by: userId
        };

        const tableId = await TableConfig.create(newTable);

        res.status(201).json({
            success: true,
            message: 'Tạo bàn thành công',
            data: {
                tableId,
                roomCode,
                ...newTable
            }
        });

    } catch (error) {
        console.error('Error creating table:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tạo bàn chơi'
        });
    }
};

// Helper functions
function getLevelName(minBuyIn) {
    if (minBuyIn <= 5000) return 'Tập Sự';
    if (minBuyIn <= 10000) return 'Nghiệp Dư';
    if (minBuyIn <= 20000) return 'Chuyên Nghiệp';
    return 'Master';
}

function formatBetLevel(smallBlind) {
    const amount = smallBlind * 2; // Big blind
    if (amount >= 1000) return `${amount / 1000}K`;
    return amount.toString();
}

// Export all functions
export default {
    getPublicTables,
    joinTable,
    createTable
};
