/**
 * WordWiz 使用手册生成脚本
 * 运行: node scripts/generate_manual.js
 * 生成: docs/WordWiz_使用手册.docx
 */
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, AlignmentType,
  BorderStyle, PageBreak, ShadingType
} = require('docx');

async function generateManual() {
  const doc = new Document({
    title: 'WordWiz 使用手册',
    description: '跨平台单词学习APP使用指南',
    styles: {
      default: {
        document: {
          run: { size: 22, font: 'Microsoft YaHei' },
          paragraph: { spacing: { after: 120 } }
        },
        heading1: {
          run: { size: 36, bold: true, color: '2D3748' },
          paragraph: { spacing: { before: 400, after: 240 } }
        },
        heading2: {
          run: { size: 30, bold: true, color: '4A5568' },
          paragraph: { spacing: { before: 300, after: 200 } }
        },
        heading3: {
          run: { size: 26, bold: true, color: '718096' },
          paragraph: { spacing: { before: 200, after: 120 } }
        }
      }
    },
    sections: [
      // ===== 封面 =====
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }
          }
        },
        children: [
          new Paragraph({ spacing: { before: 3000 } }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'WordWiz', size: 60, bold: true, color: '5A67D8' })]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [new TextRun({ text: '跨平台单词学习 App · 纯前端本地离线版', size: 28, color: '718096' })]
          }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 800 } }),
          new Paragraph({
            alignment: AlignmentType.CENTER, spacing: { after: 100 },
            children: [new TextRun({ text: '使 用 手 册', size: 44, bold: true, color: '2D3748' })]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER, spacing: { before: 600 },
            children: [new TextRun({ text: '版本：1.0.0', size: 22, color: 'A0AEC0' })]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: '更新日期：' + new Date().toLocaleDateString('zh-CN'), size: 22, color: 'A0AEC0' })]
          }),
          new Paragraph({ children: [new PageBreak()] })
        ]
      },

      // ===== 目录 =====
      {
        properties: {
          page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } }
        },
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun('目 录')]
          }),
          ...[
            ['一、软件简介', 'A'],
            ['二、快速开始', 'B'],
            ['三、首页 — 学习单词', 'C'],
            ['四、挑战模式', 'D'],
            ['五、错题集', 'E'],
            ['六、收藏夹', 'F'],
            ['七、回收站', 'G'],
            ['八、设置 / 词书管理', 'H'],
            ['九、常见问题 FAQ', 'I']
          ].map(([title, tag]) =>
            new Paragraph({
              spacing: { before: 80 },
              children: [
                new TextRun({ text: title, size: 24, bold: true, color: '4A5568' })
              ]
            })
          ),
          new Paragraph({ children: [new PageBreak()] })
        ]
      },

      // ===== 一、软件简介 =====
      contentSection('一、软件简介', [
        new Paragraph({
          children: [
            new TextRun({ text: 'WordWiz', bold: true, size: 24 }),
            new TextRun(' 是一个完全离线、纯前端运行的单词学习应用。它使用浏览器的 IndexedDB 数据库存储所有数据，无需注册账号，无需联网，所有数据都保存在你的电脑上。')
          ]
        }),
        new Paragraph({ spacing: { before: 120 } }),
        new Paragraph({ children: [new TextRun({ text: '✧ 核心特性', bold: true, size: 24, color: '5A67D8' })] }),
        bulletPoint('📚 多词书管理 — 导入多本词汇书，可自由勾选激活哪些词书'),
        bulletPoint('🎯 挑战模式 — 四选一 / 拼写模式，带生命值和限时挑战'),
        bulletPoint('📊 熟悉度系统 — 0~5 级熟悉度标记，自动追踪学习进度'),
        bulletPoint('⭐ 收藏夹 + ❌ 错题本 — 专项复习薄弱环节'),
        bulletPoint('🗑️ 回收站 — 误删可恢复，30 天自动清理'),
        bulletPoint('🎮 成就系统 — 学习打卡、连续挑战等成就解锁'),
        bulletPoint('🌐 局域网访问 — 手机也能用（需额外配置）'),
      ]),

      // ===== 二、快速开始 =====
      contentSection('二、快速开始', [
        new Paragraph({
          children: [new TextRun({ text: '2.1 启动应用', bold: true, size: 26, color: '4A5568' })]
        }),
        numberedStep(1, '双击 start.bat 启动服务器。'),
        numberedStep(2, '浏览器自动打开 http://localhost:3000。'),
        numberedStep(3, '首次使用会自动创建内置词书并预置示例单词。'),
        numberedStep(4, '进入「设置」页 → 点击「导入」按钮，选择词汇书文件（CSV 或 JSON）。'),
        new Paragraph({ spacing: { before: 120 } }),
        new Paragraph({
          children: [new TextRun({ text: '注意：', bold: true, color: 'E53E3E' }),
                     new TextRun(' 必须通过 http://localhost:3000 访问，不要直接双击 index.html 文件，否则数据库无法连接！')]
        }),
        new Paragraph({ spacing: { before: 120 } }),
        new Paragraph({
          children: [new TextRun({ text: '2.2 页面导航', bold: true, size: 26, color: '4A5568' })]
        }),
        bulletPoint('📚 学习 — 首页，浏览单词、搜索、筛选、排序'),
        bulletPoint('⭐ 收藏 — 已收藏的单词列表'),
        bulletPoint('🗑️ 回收站 — 已删除的单词，可恢复或永久删除'),
        bulletPoint('⚡ 挑战 — 随机抽词答题模式'),
        bulletPoint('❌ 错题 — 挑战中答错的单词汇总'),
        bulletPoint('⚙️ 设置 — 词书管理、导入导出、统计、提醒'),
      ]),

      // ===== 三、首页 =====
      contentSection('三、首页 — 学习单词', [
        new Paragraph({
          children: [new TextRun({ text: '3.1 词书筛选', bold: true, size: 26, color: '4A5568' })]
        }),
        new Paragraph({
          children: [new TextRun('在首页顶部可以看到所有已导入的词书按钮。点击即可切换激活/停用某个词书。')]
        }),
        new Paragraph({ spacing: { before: 60 }, children: [new TextRun({ text: '⚡ 重要提示：', bold: true, color: 'E53E3E' })] }),
        new Paragraph({
          children: [
            new TextRun({ text: '  当多本词书含有相同的单词时，不会重复导入。该单词只会归属于首次导入时的词书。', size: 22 })
          ]
        }),
        new Paragraph({
          children: [
            new TextRun({ text: '  例如：先导入「考研词汇」再导入「四级词汇」，重合的单词只属于「考研词汇」词书。如果你只勾选「四级词汇」，可能看不到完整的四级词书内容。因此导入顺序最好遵从「先大范围后小范围」的原则。', size: 22, color: '718096' })
          ]
        }),
        new Paragraph({ spacing: { before: 120 } }),
        new Paragraph({
          children: [new TextRun({ text: '3.2 分类筛选', bold: true, size: 26, color: '4A5568' })]
        }),
        new Paragraph({
          children: [new TextRun('点击「全部」「四级」「六级」「考研」等分类按钮，只显示该分类的单词。这个分类是导入时词汇书中的 category 字段决定的。')]
        }),
        new Paragraph({ spacing: { before: 120 } }),
        new Paragraph({
          children: [new TextRun({ text: '3.3 搜索单词', bold: true, size: 26, color: '4A5568' })]
        }),
        new Paragraph({
          children: [new TextRun('在搜索框中输入英文或中文关键词，下拉列表会实时显示匹配结果（最多 50 个）。')]
        }),
        bulletPoint('点击搜索结果会自动定位到该单词并高亮 2 秒'),
        bulletPoint('如果当前是"按单元分组"的默认排序模式，会定位到具体单元卡片'),
        bulletPoint('如果当前是按熟悉度/字母等排序模式，会定位到扁平列表中的位置'),
        new Paragraph({ spacing: { before: 120 } }),
        new Paragraph({
          children: [new TextRun({ text: '3.4 排序模式', bold: true, size: 26, color: '4A5568' })]
        }),
        new Paragraph({
          children: [new TextRun('点击排序选择器切换显示模式：')]
        }),
        bulletPoint('默认 — 按单元分组显示（每 100 词为一个单元）'),
        bulletPoint('熟悉度从高到低 — 优先显示掌握好的单词'),
        bulletPoint('熟悉度从低到高 — 优先显示不熟的单词，方便复习'),
        bulletPoint('字母 A→Z / Z→A — 按字母顺序排序'),
        bulletPoint('随机混序 — 打乱顺序展示'),
        new Paragraph({ spacing: { before: 120 } }),
        new Paragraph({
          children: [new TextRun({ text: '3.5 单词操作', bold: true, size: 26, color: '4A5568' })]
        }),
        bulletPoint('✓ 按钮 — 点击增加熟悉度 1 级（上限 5 级）'),
        bulletPoint('⭐ 按钮 — 点击收藏/取消收藏'),
        bulletPoint('✕ 按钮 — 移入回收站'),
        bulletPoint('熟悉度圆点 — 5 个小圆点表示 0~5 级，灰色为未达到，彩色为已掌握'),
      ]),

      // ===== 四、挑战模式 =====
      contentSection('四、挑战模式', [
        new Paragraph({
          children: [new TextRun({ text: '4.1 进入挑战', bold: true, size: 26, color: '4A5568' })]
        }),
        new Paragraph({
          children: [new TextRun('点击导航栏「⚡ 挑战」进入挑战模式。在开始页可以配置以下选项：')]
        }),
        new Paragraph({ spacing: { before: 80 } }),
        new Paragraph({
          children: [new TextRun({ text: '4.2 答题模式', bold: true, size: 26, color: '4A5568' })]
        }),
        bulletPoint('📋 四选一 — 看英文单词，从 4 个选项中选出正确释义'),
        bulletPoint('✍️ 汉→英拼写 — 看中文释义，手动输入对应的英文单词'),
        bulletPoint('✍️ 英→汉拼写 — 看英文单词，手动输入对应的中文释义（支持模糊匹配）'),
        new Paragraph({ spacing: { before: 120 } }),
        new Paragraph({
          children: [new TextRun({ text: '4.3 难度与设置', bold: true, size: 26, color: '4A5568' })]
        }),
        bulletPoint('🌱 简单 — 只抽取熟悉度 ≥ 3 的单词'),
        bulletPoint('⚖️ 普通 — 全部单词（默认）'),
        bulletPoint('🔥 困难 — 只抽取熟悉度 ≤ 2 的单词'),
        bulletPoint('题数可选：10 / 20 / 50 / 100 / 自定义（1~200）'),
        bulletPoint('❤️ 生命值模式 — 3 条命，答错扣 1 条，扣完即结束'),
        bulletPoint('⏱ 限时模式 — 每题限时 10 秒，超时算答错'),
        new Paragraph({ spacing: { before: 120 } }),
        new Paragraph({
          children: [new TextRun({ text: '4.4 挑战范围', bold: true, size: 26, color: '4A5568' })]
        }),
        bulletPoint('激活词书 — 只从当前勾选的词书中抽题'),
        bulletPoint('全部词库 — 无论是否激活，从所有词书中抽题'),
        bulletPoint('按分类 — 按分类筛选抽题'),
        bulletPoint('📝 错题集 — 从错题本中抽题，针对性复习'),
        new Paragraph({ spacing: { before: 120 } }),
        new Paragraph({
          children: [new TextRun({ text: '4.5 冷却机制与熟练度影响', bold: true, size: 26, color: '4A5568' })]
        }),
        bulletPoint('📌 挑战过的单词 7 天内不会重复出现'),
        bulletPoint('📌 答对 → 熟悉度 +1；答错或超时 → 熟悉度 -1'),
        bulletPoint('📌 答错的单词会自动收集到「错题集」中'),
        bulletPoint('📌 挑战结束后会显示错题回顾，方便查漏补缺'),
      ]),

      // ===== 五、错题集 =====
      contentSection('五、错题集', [
        new Paragraph({
          children: [new TextRun('错题集自动收集挑战模式中答错的单词，最多保留 200 条。')]
        }),
        bulletPoint('在错题集页面可以查看所有错题及答错日期'),
        bulletPoint('可清空全部错题'),
        bulletPoint('可导出错题到 JSON 或 CSV 文件'),
        bulletPoint('挑战模式选择「错题集」范围时，可针对性重复练习'),
      ]),

      // ===== 六、收藏夹 =====
      contentSection('六、收藏夹', [
        new Paragraph({
          children: [new TextRun('在首页或各页面点击 ⭐ 按钮即可收藏单词。')]
        }),
        bulletPoint('支持按分类筛选收藏列表'),
        bulletPoint('支持多种排序模式（与首页相同）'),
        bulletPoint('可导出收藏夹到 JSON 或 CSV'),
      ]),

      // ===== 七、回收站 =====
      contentSection('七、回收站', [
        new Paragraph({
          children: [new TextRun('被删除的单词会进入回收站，30 天后自动永久删除。')]
        }),
        bulletPoint('🔄 恢复 — 点击单词的恢复按钮，从回收站还原'),
        bulletPoint('🗑️ 永久删除 — 物理删除，不可恢复'),
        bulletPoint('🧹 清空回收站 — 一键清空所有回收站单词'),
        bulletPoint('⏰ 自动清理 — 过期 30 天的单词在启动时自动清除'),
      ]),

      // ===== 八、设置 / 词书管理 =====
      contentSection('八、设置 / 词书管理', [
        new Paragraph({
          children: [new TextRun({ text: '8.1 词书管理', bold: true, size: 26, color: '4A5568' })]
        }),
        new Paragraph({
          children: [new TextRun('在设置页的「词书管理」区域可以：')]
        }),
        bulletPoint('查看所有词书列表'),
        bulletPoint('勾选/取消勾选想要激活的词书（首页只显示激活词书中的单词）'),
        bulletPoint('新增词书（输入名称后点击「新增词书」按钮）'),
        bulletPoint('删除词书（非系统词书可删除，单词会自动转移到系统默认词书，不会丢失）'),
        new Paragraph({ spacing: { before: 120 } }),
        new Paragraph({
          children: [new TextRun({ text: '8.2 导入词库（CSV/JSON）', bold: true, size: 26, color: '4A5568' })]
        }),
        new Paragraph({
          children: [new TextRun('支持 CSV 和 JSON 两种格式导入。推荐先从「下载模板」开始。')]
        }),
        new Paragraph({ spacing: { before: 60 } }),
        new Paragraph({ children: [new TextRun({ text: 'CSV 格式要求：', bold: true, color: '5A67D8' })] }),
        bulletPoint('第一行为表头：word,definition,category,unit,book_source'),
        bulletPoint('word — 必填，英文单词'),
        bulletPoint('definition — 必填，中文释义'),
        bulletPoint('category — 可选，例如：四级、六级、考研、托福、雅思等'),
        bulletPoint('unit — 可选，单元编号，相同编号归为一组'),
        bulletPoint('book_source — 可选，系统自动创建同名词书'),
        new Paragraph({ spacing: { before: 60 } }),
        new Paragraph({ children: [new TextRun({ text: 'JSON 格式要求：', bold: true, color: '5A67D8' })] }),
        bulletPoint('顶层是一个数组，每个元素包含 word / definition / category / unit'),
        bulletPoint('也可以使用 { words: [...] } 或 { data: [...] } 结构'),
        new Paragraph({ spacing: { before: 80 } }),
        new Paragraph({
          children: [new TextRun({ text: '导入时如果遇到重复单词：', bold: true, color: 'E53E3E' })]
        }),
        bulletPoint('系统会自动跳过重复单词（释义为空时会尝试补充）'),
        bulletPoint('⚠️ 单词的 book_id 和 category 不会被覆盖，保留第一次导入时的归属'),
        bulletPoint('建议先导入大范围词书（如四级），再导入小范围词书（如考研），这样重合的单词归属正确'),
        new Paragraph({ spacing: { before: 120 } }),
        new Paragraph({
          children: [new TextRun({ text: '8.3 导出数据', bold: true, size: 26, color: '4A5568' })]
        }),
        bulletPoint('导出 JSON — 所有单词（含熟悉度、收藏状态）'),
        bulletPoint('导出 CSV — 所有单词（Excel 可直接打开）'),
        new Paragraph({ spacing: { before: 120 } }),
        new Paragraph({
          children: [new TextRun({ text: '8.4 每日提醒', bold: true, size: 26, color: '4A5568' })]
        }),
        new Paragraph({
          children: [new TextRun('在设置页开启「每日复习提醒」后，系统会在指定时间发送提醒通知。')]
        }),
        bulletPoint('🔔 开启后，需要授予浏览器通知权限'),
        bulletPoint('⏰ 默认提醒时间 20:00，可自行调整'),
        bulletPoint('⚠️ 提醒功能需要浏览器保持打开状态（可最小化）'),
        bulletPoint('📌 提醒时会同时弹出桌面通知 + 页面内提示 + 提示音（三重保障）'),
        bulletPoint('📌 如果关闭了浏览器标签页，提醒无法推送（纯前端应用的限制）'),
        new Paragraph({ spacing: { before: 120 } }),
        new Paragraph({
          children: [new TextRun({ text: '8.5 统计与成就', bold: true, size: 26, color: '4A5568' })]
        }),
        bulletPoint('统计仪表盘 — 显示总词数、学习天数、今日学习等数据'),
        bulletPoint('成就墙 — 解锁各项成就（新手入门、连续打卡、收藏达人等）'),
        bulletPoint('挑战记录 — 历史挑战成绩汇总（正确率、用时、次数）'),
        new Paragraph({ spacing: { before: 120 } }),
        new Paragraph({
          children: [new TextRun({ text: '8.6 局域网访问', bold: true, size: 26, color: '4A5568' })]
        }),
        bulletPoint('在设置页可查看局域网地址'),
        bulletPoint('需要修改 start.bat，添加 --bind 0.0.0.0 参数'),
        bulletPoint('确保手机与电脑在同一 WiFi 下'),
        bulletPoint('在手机浏览器输入显示的地址即可访问'),
      ]),

      // ===== 九、常见问题 =====
      contentSection('九、常见问题 FAQ', [
        qa('Q1: 页面打不开，显示"启动失败"怎么办？',
           'A: 请确保通过 http://localhost:3000 访问，不要直接双击 index.html。如果问题持续，点击「重置数据库」试试。'),
        qa('Q2: 为什么搜索单词后点击没有反应？',
           'A: 检查当前排序模式。按熟悉度/字母排序时，搜索结果同样能定位到单词位置，如果还是找不到，可以先切换到「默认」排序模式再搜索。'),
        qa('Q3: 为什么导入多本词书后，有些词看不到了？',
           'A: 因为重叠的单词只归入第一次导入的词书。例如先导入「考研词汇」再导入「四级词汇」，重叠单词属于考研词书。勾选「四级词汇」时看不到重叠单词是正常现象。建议依次导入时注意顺序。'),
        qa('Q4: 为什么到达提醒时间了没有收到通知？',
           'A: ① 确保浏览器标签页保持打开状态 ② 检查是否已授予通知权限 ③ 检查设置中是否已开启提醒 ④ 如果之前拒绝过权限，需要在浏览器设置中重新允许。系统会同时使用桌面通知 + 页面提示 + 声音三重方式提醒。'),
        qa('Q5: 挑战模式中答错的单词会怎样？',
           'A: 答错的单词熟悉度会降低 1 级，同时自动加入错题集。在挑战范围选择「错题集」可以针对练习。错题集最多保留 200 条。'),
        qa('Q6: 挑战过的单词还会再出现吗？',
           'A: 已挑战的单词有 7 天冷却期，7 天后可以再次挑战。'),
        qa('Q7: 如何备份数据？',
           'A: 进入「设置」→「导出 JSON」，保存导出的文件即可。恢复时选择导入该 JSON 文件。'),
        qa('Q8: 如何删除多本词书中重复的单词？',
           'A: 系统在导入时会自动去重，不会产生真正的重复。但如果你想要删除某个单词，可以在首页找到该单词，点击 ✕ 移入回收站，然后去回收站永久删除。'),
        qa('Q9: 能否在手机上使用？',
           'A: 可以。需修改 start.bat 添加 --bind 0.0.0.0 参数启动，然后在设置页查看局域网地址，手机浏览器输入该地址即可。手机和电脑必须连接同一 WiFi。'),
        qa('Q10: 如何彻底重置所有数据？',
           'A: 在启动失败页面点击「重置数据库」按钮，或者在浏览器开发者工具（F12）→ Application → IndexedDB → 右键删除 WordWizDB 数据库，然后刷新页面。'),
      ]),

      // ===== 附录 =====
      contentSection('附录：快捷键与技巧', [
        new Paragraph({ children: [
          new TextRun({ text: '💡 使用技巧', bold: true, size: 26, color: '5A67D8' })
        ]}),
        bulletPoint('熟悉度 0→5 对应：陌生、见过、模糊、认识、熟悉、掌握'),
        bulletPoint('建议每天先复习熟悉度低的单词（排序选"熟悉度从低到高"），再学新词'),
        bulletPoint('挑战模式的「错题集」范围针对性极强，建议每周至少做一次'),
        bulletPoint('多词书导入时，先导入综合词书（如四级），再导入专项词书（如考研）'),
        bulletPoint('经常导出 JSON 备份，防止数据丢失'),
      ]),

      // ===== 结尾 =====
      {
        properties: {
          page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } }
        },
        children: [
          new Paragraph({ spacing: { before: 2000 } }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [new TextRun({ text: '— 全文完 —', size: 24, color: 'A0AEC0' })]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: '祝您使用愉快，学习进步！🎉', size: 28, bold: true, color: '5A67D8' })]
          }),
        ]
      }
    ]
  });

  const docsDir = path.resolve(__dirname, '..', 'docs');
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
  const filePath = path.join(docsDir, 'WordWiz_使用手册.docx');
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(filePath, buffer);
  console.log('✅ 使用手册已生成: ' + filePath);
}

function contentSection(title, paragraphs) {
  return {
    properties: {
      page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } }
    },
    children: [
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(title)] }),
      ...paragraphs,
      new Paragraph({ children: [new PageBreak()] })
    ]
  };
}

function bulletPoint(text) {
  return new Paragraph({
    spacing: { before: 40 },
    indent: { left: 400, hanging: 200 },
    children: [new TextRun({ text, size: 22 })]
  });
}

function numberedStep(number, text) {
  return new Paragraph({
    spacing: { before: 40 },
    indent: { left: 400, hanging: 200 },
    children: [
      new TextRun({ text: `${number}. `, bold: true, size: 22 }),
      new TextRun({ text, size: 22 })
    ]
  });
}

function qa(question, answer) {
  return new Paragraph({
    spacing: { before: 100 },
    children: [
      new TextRun({ text: question, bold: true, size: 22, color: '2B6CB0' }),
      new TextRun({ break: 1 }),
      new TextRun({ text: answer, size: 22 }),
    ]
  });
}

generateManual().catch(err => {
  console.error('❌ 生成失败:', err);
  process.exit(1);
});
