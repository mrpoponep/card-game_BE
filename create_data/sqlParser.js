// sqlParser.js
import fs from 'fs';

/**
 * 🔍 SQL Parser - Phân tích file Database.sql
 * Trích xuất cấu trúc bảng, triggers, procedures, indexes
 */

export class SQLParser {
  constructor(sqlFilePath) {
    this.sqlFilePath = sqlFilePath;
    this.sqlContent = '';
    // Mảng lưu tất cả commands theo thứ tự
    this.commands = [];
    // Phân loại commands (dùng để thống kê)
    this.tables = new Map();
    this.triggers = [];
    this.procedures = [];
    this.indexes = [];
    this.sampleData = [];
  }

  // 📖 Đọc file SQL
  readFile() {
    try {
      console.log(`📖 Reading SQL file: ${this.sqlFilePath}`);
      this.sqlContent = fs.readFileSync(this.sqlFilePath, 'utf8');
      console.log(`✅ SQL file read successfully (${this.sqlContent.length} characters)`);
      return true;
    } catch (error) {
      console.error('❌ Error reading SQL file:', error.message);
      return false;
    }
  }

  // � Parse các lệnh SQL theo thứ tự xuất hiện trong file

  // 📋 Parse columns từ table body
  parseColumns(tableBody) {
    const columns = [];
    const lines = tableBody.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines, constraints, foreign keys
      if (!trimmed || 
          trimmed.startsWith('PRIMARY KEY') ||
          trimmed.startsWith('FOREIGN KEY') ||
          trimmed.startsWith('UNIQUE') ||
          trimmed.startsWith('INDEX') ||
          trimmed.startsWith('KEY')) {
        continue;
      }
      
      // Parse column definition
      const columnMatch = trimmed.match(/^(\w+)\s+([A-Z]+(?:\([^)]+\))?)(.*)/i);
      if (columnMatch) {
        const columnName = columnMatch[1];
        const dataType = columnMatch[2];
        const constraints = columnMatch[3];
        
        columns.push({
          name: columnName,
          type: dataType,
          constraints: constraints.trim(),
          nullable: !constraints.includes('NOT NULL'),
          autoIncrement: constraints.includes('AUTO_INCREMENT'),
          unique: constraints.includes('UNIQUE'),
          default: this.parseDefault(constraints)
        });
      }
    }
    
    return columns;
  }

  // 🔑 Parse PRIMARY KEY
  parsePrimaryKey(tableBody) {
    const pkMatch = tableBody.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
    return pkMatch ? pkMatch[1].trim() : null;
  }

  // 🔗 Parse FOREIGN KEYs
  parseForeignKeys(tableBody) {
    const foreignKeys = [];
    const fkRegex = /FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(\w+)\s*\(([^)]+)\)/gi;
    let match;
    
    while ((match = fkRegex.exec(tableBody)) !== null) {
      foreignKeys.push({
        column: match[1].trim(),
        referencesTable: match[2].trim(),
        referencesColumn: match[3].trim()
      });
    }
    
    return foreignKeys;
  }

  // 🎯 Parse DEFAULT value
  parseDefault(constraints) {
    const defaultMatch = constraints.match(/DEFAULT\s+([^,\s]+|'[^']+'|"[^"]+"|CURRENT_TIMESTAMP)/i);
    if (defaultMatch) {
      let value = defaultMatch[1].trim();
      // Remove quotes if present
      if ((value.startsWith("'") && value.endsWith("'")) ||
          (value.startsWith('"') && value.endsWith('"'))) {
        value = value.slice(1, -1);
      }
      return value;
    }
    return null;
  }

  // 🚀 Parse toàn bộ - Theo thứ tự xuất hiện
  parseAll() {
    if (!this.readFile()) {
      return false;
    }
    
    console.log('🔍 Parsing SQL commands in order...');
    
    // Parse tất cả commands theo thứ tự xuất hiện
    this.parseCommandsInOrder();
    
    // Phân loại commands để thống kê
    this.categorizeCommands();
    
    return true;
  }

  // 🔄 Parse các lệnh SQL theo thứ tự xuất hiện trong file
  parseCommandsInOrder() {
    // Bước 1: Xác định vùng TRIGGER/PROCEDURE (để loại trừ INSERT bên trong)
    const excludedRanges = [];
    
    // Tìm tất cả TRIGGER
    const triggerRegex = /CREATE\s+TRIGGER\s+(\w+)([\s\S]*?)END\s*\$\$/gi;
    let match;
    while ((match = triggerRegex.exec(this.sqlContent)) !== null) {
      excludedRanges.push({
        start: match.index,
        end: match.index + match[0].length
      });
    }
    
    // Tìm tất cả PROCEDURE
    const procedureRegex = /CREATE\s+PROCEDURE\s+(\w+)([\s\S]*?)END\s*\$\$/gi;
    while ((match = procedureRegex.exec(this.sqlContent)) !== null) {
      excludedRanges.push({
        start: match.index,
        end: match.index + match[0].length
      });
    }
    
    // Hàm kiểm tra vị trí có nằm trong vùng loại trừ không
    const isInExcludedRange = (position) => {
      return excludedRanges.some(range => position >= range.start && position <= range.end);
    };
    
    // Bước 2: Parse từng loại lệnh
    const patterns = [
      // CREATE TABLE
      {
        type: 'CREATE_TABLE',
        regex: /CREATE\s+TABLE\s+(\w+)\s*\(([\s\S]*?)\);/gi,
        extract: (match) => ({
          type: 'CREATE_TABLE',
          name: match[1],
          body: match[2],
          sql: match[0],
          position: match.index
        })
      },
      // CREATE INDEX
      {
        type: 'CREATE_INDEX',
        regex: /CREATE\s+INDEX\s+(\w+)\s+ON\s+(\w+)\s*\(([^)]+)\);/gi,
        extract: (match) => ({
          type: 'CREATE_INDEX',
          name: match[1],
          table: match[2],
          columns: match[3].split(',').map(c => c.trim()),
          sql: match[0],
          position: match.index
        })
      },
      // CREATE TRIGGER
      {
        type: 'CREATE_TRIGGER',
        regex: /CREATE\s+TRIGGER\s+(\w+)([\s\S]*?)END\s*\$\$/gi,
        extract: (match) => ({
          type: 'CREATE_TRIGGER',
          name: match[1],
          definition: match[0],
          sql: match[0],
          position: match.index
        })
      },
      // CREATE PROCEDURE
      {
        type: 'CREATE_PROCEDURE',
        regex: /CREATE\s+PROCEDURE\s+(\w+)([\s\S]*?)END\s*\$\$/gi,
        extract: (match) => ({
          type: 'CREATE_PROCEDURE',
          name: match[1],
          definition: match[0],
          sql: match[0],
          position: match.index
        })
      },
      // INSERT INTO (chỉ lấy ngoài TRIGGER/PROCEDURE)
      {
        type: 'INSERT',
        regex: /INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*([\s\S]*?);/gi,
        extract: (match) => ({
          type: 'INSERT',
          table: match[1],
          columns: match[2].split(',').map(c => c.trim()),
          values: match[3],
          sql: match[0],
          position: match.index
        }),
        skipIfInExcluded: true // Đánh dấu cần kiểm tra vùng loại trừ
      }
    ];

    // Parse từng loại lệnh
    patterns.forEach(pattern => {
      let match;
      pattern.regex.lastIndex = 0;
      while ((match = pattern.regex.exec(this.sqlContent)) !== null) {
        // Skip nếu INSERT nằm trong TRIGGER/PROCEDURE
        if (pattern.skipIfInExcluded && isInExcludedRange(match.index)) {
          continue;
        }
        
        const command = pattern.extract(match);
        command.sql = command.sql.replace(/\$\$/g, ''); // Xóa $$
        this.commands.push(command);
      }
    });

    // Sắp xếp commands theo thứ tự xuất hiện (position)
    this.commands.sort((a, b) => a.position - b.position);
    
    console.log(`✅ Parsed ${this.commands.length} SQL commands in order`);
  }

  // 📊 Phân loại commands để thống kê
  categorizeCommands() {
    console.log('📊 Categorizing commands...');
    
    this.commands.forEach(cmd => {
      switch (cmd.type) {
        case 'CREATE_TABLE':
          const tableInfo = {
            name: cmd.name,
            columns: this.parseColumns(cmd.body),
            foreignKeys: this.parseForeignKeys(cmd.body),
            primaryKey: this.parsePrimaryKey(cmd.body)
          };
          this.tables.set(cmd.name, tableInfo);
          break;
          
        case 'CREATE_INDEX':
          this.indexes.push({
            name: cmd.name,
            table: cmd.table,
            columns: cmd.columns
          });
          break;
          
        case 'CREATE_TRIGGER':
          this.triggers.push({
            name: cmd.name,
            definition: cmd.definition
          });
          break;
          
        case 'CREATE_PROCEDURE':
          this.procedures.push({
            name: cmd.name,
            definition: cmd.definition
          });
          break;
          
        case 'INSERT':
          this.sampleData.push({
            table: cmd.table,
            columns: cmd.columns,
            values: cmd.values
          });
          break;
      }
    });
    
    console.log(`✅ Categorized: ${this.tables.size} tables, ${this.indexes.length} indexes, ${this.triggers.length} triggers, ${this.procedures.length} procedures, ${this.sampleData.length} inserts`);
  }

  // 📊 Export parsed data
  export() {
    return {
      commands: this.commands,  // Toàn bộ commands theo thứ tự
      tables: Array.from(this.tables.values()),
      indexes: this.indexes,
      triggers: this.triggers,
      procedures: this.procedures,
      sampleData: this.sampleData
    };
  }

  // 🖨️ Print summary
  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 SQL PARSING SUMMARY');
    console.log('='.repeat(60));
    console.log(`📝 Total commands: ${this.commands.length} (in order)`);
    console.log('');
    console.log('Command breakdown:');
    
    // Đếm theo loại
    const counts = {};
    this.commands.forEach(cmd => {
      counts[cmd.type] = (counts[cmd.type] || 0) + 1;
    });
    
    Object.entries(counts).forEach(([type, count]) => {
      console.log(`   • ${type}: ${count}`);
    });
    
    console.log('');
    console.log('Detailed:');
    console.log(`   📋 Tables: ${this.tables.size}`);
    this.tables.forEach((table, name) => {
      console.log(`      • ${name}: ${table.columns.length} columns`);
    });
    console.log(`   ⚡ Indexes: ${this.indexes.length}`);
    console.log(`   🎯 Triggers: ${this.triggers.length}`);
    console.log(`   📦 Procedures: ${this.procedures.length}`);
    console.log(`   🎭 Sample data: ${this.sampleData.length} INSERT statements`);
    console.log('='.repeat(60) + '\n');
  }
}

export default SQLParser;