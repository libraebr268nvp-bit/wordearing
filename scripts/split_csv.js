#!/usr/bin/env node
/**
 * split_csv.js — 从 ecdict.csv 拆分生成多本词汇书 JSON
 * 
 * 生成的词书 (基于 ecdict 实际可用 tag):
 *   - words_ky.json       (考研: tag 含 ky)
 *   - words_toefl.json    (托福: tag 含 toefl)
 *   - words_ielts.json    (雅思: tag 含 ielts)
 *   - words_gre.json      (GRE: tag 含 gre)
 *   - words_gk.json       (高考: tag 含 gk)
 *   - words_zk.json       (中考: tag 含 zk)
 * 注意: ecdict 中不包含 spoken/simple/computer/IT/ic/ai 等标签
 *       如需要口语/专业词书，需从其他数据源补充
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const CSV_PATH = path.join(ROOT, 'ecdict.csv');

// 词书定义: [文件名, 标签列表, 分类名]
// 注意: ecdict 中不存在 spoken/simple/computer/IT/ic/ai 等标签
// 实际可用 tag: gre, toefl, ielts, ky, cet6, cet4, gk(高考), zk(中考)
const BOOK_DEFS = [
  ['words_ky.json',       ['ky'],                         '考研'],
  ['words_toefl.json',    ['toefl'],                      '托福'],
  ['words_ielts.json',    ['ielts'],                      '雅思'],
  ['words_gre.json',      ['gre'],                        'GRE'],
  ['words_gk.json',       ['gk'],                         '高考'],
  ['words_zk.json',       ['zk'],                         '中考'],
];

/**
 * 解析 tag 字段为小写标签数组
 */
function parseTags(tagStr) {
  if (!tagStr || !tagStr.trim()) return [];
  return tagStr.trim().toLowerCase().split(/\s+/);
}

/**
 * 清理释义
 * 如果清洗后为空，保留原始翻译（至少有个可用的释义）
 */
function cleanTranslation(text) {
  if (!text) return '';
  const original = text.trim();
  let cleaned = text
    .replace(/<br\s*\/?>/gi, '；')
    .replace(/\n/g, '；')
    .replace(/\r/g, '')
    .replace(/^(vt\.|vi\.|n\.|a\.|adv\.|prep\.|v\.|pron\.|conj\.|int\.|art\.|num\.|abbr\.)\s*/i, '')
    .trim()
    .replace(/[；;，,]+$/, '')
    .trim()
    .slice(0, 200);
  
  // 如果清洗后为空，保留原始翻译（确保每个导入的单词至少有一个可读的释义）
  if (!cleaned || cleaned.length < 2) {
    return original.slice(0, 200);
  }
  return cleaned;
}


/**
 * 将一行 CSV 解析为对象
 */
function parseCSVLine(line) {
  const result = {};
  let current = '';
  let inQuotes = false;
  const fields = [];

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/**
 * 主流程
 */
async function main() {
  console.log('='.repeat(60));
  console.log('  WordWiz 多词书拆分工具');
  console.log('  数据来源: skywind3000/ECDICT (MIT License)');
  console.log('='.repeat(60));
  console.log();

  // 检查 CSV 文件
  if (!fs.existsSync(CSV_PATH)) {
    console.error('❌ 找不到 ecdict.csv，请先下载放到项目根目录');
    process.exit(1);
  }
  const stats = fs.statSync(CSV_PATH);
  console.log(`📖 正在读取: ecdict.csv (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
  console.log();

  // 按分类收集单词
  const results = BOOK_DEFS.map(() => []);

  // 读取 CSV 第一行获取表头
  const fileContent = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = fileContent.split('\n');
  const headerLine = lines[0].trim();
  const headers = parseCSVLine(headerLine);

  // 找到 word / translation / tag 列索引
  const wordIdx = headers.indexOf('word');
  const transIdx = headers.indexOf('translation');
  const tagIdx = headers.indexOf('tag');

  if (wordIdx === -1 || transIdx === -1 || tagIdx === -1) {
    console.error('❌ CSV 缺少必要列 (word, translation, tag)');
    console.error(`   找到的列: ${headers.join(', ')}`);
    process.exit(1);
  }

  console.log(`   CSV 列: word[${wordIdx}], translation[${transIdx}], tag[${tagIdx}]`);
  console.log(`   数据行数: ${lines.length - 1}`);
  console.log();

  // 逐行处理
  let processed = 0;
  let matched = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCSVLine(line);
    const word = (fields[wordIdx] || '').trim();
    const translation = (fields[transIdx] || '').trim();
    const tagStr = (fields[tagIdx] || '').trim();

    if (!word || !translation) continue;
    processed++;

    const tags = parseTags(tagStr);
    if (tags.length === 0) continue;

    // 检查匹配哪本词书
    const cleaned = cleanTranslation(translation);
    const item = {
      word,
      definition: cleaned,
      category: '',
      unit: 1,
    };

    BOOK_DEFS.forEach(([, tagFilters, category], bookIdx) => {
      if (tagFilters.some(t => tags.includes(t))) {
        item.category = category;
        results[bookIdx].push({ ...item });
        matched++;
      }
    });

    if (processed % 50000 === 0) {
      console.log(`   已处理 ${processed} 行... (匹配 ${matched})`);
    }
  }

  console.log(`   处理完成: ${processed} 行, 匹配 ${matched} 个单词`);
  console.log();
  console.log('[2/2] 保存 JSON 文件...');
  console.log();

  // 确保 assets 目录存在
  fs.mkdirSync(ASSETS, { recursive: true });

  // 保存并统计
  const summary = [];
  BOOK_DEFS.forEach(([filename, , category], idx) => {
    let words = results[idx];
    // 去重 (同一单词可能出现在多本词书的条目里, 但单本内部去重)
    const seen = new Set();
    words = words.filter(w => {
      if (seen.has(w.word)) return false;
      seen.add(w.word);
      return true;
    });
    // 分配单元
    words.forEach((w, i) => { w.unit = Math.floor(i / 100) + 1; });

    const filepath = path.join(ASSETS, filename);
    fs.writeFileSync(filepath, JSON.stringify(words, null, 2), 'utf-8');
    const lastUnit = words.length > 0 ? Math.ceil(words.length / 100) : 0;
    console.log(`  ✅ ${category}: ${words.length} 词, ${lastUnit} 单元 → ${filename}`);
    summary.push({ category, count: words.length, file: filename, words });
  });

  console.log();
  console.log('='.repeat(60));
  console.log('  ✅ 拆分完成！');
  console.log();

  // 检查是否有未覆盖的tag
  console.log('  使用方法:');
  console.log('  1. 启动 WordWiz 服务器');
  console.log('  2. 进入「设置」页');
  console.log('  3. 点击「选择文件导入」');
  console.log('  4. 选择 assets/ 下对应的 JSON 文件');
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('❌ 运行出错:', err);
  process.exit(1);
});
