#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
从本地的 ecdict.csv 提取四六级单词，转换为 WordWiz 可导入的 JSON 格式
数据来源: skywind3000/ECDICT (MIT License)
"""

import json
import csv
import os
import re

def read_local_csv():
    """读取本地的 ecdict.csv 文件"""
    filepath = os.path.join(os.path.dirname(__file__), "ecdict.csv")
    if not os.path.exists(filepath):
        print(f"❌ 找不到文件: {filepath}")
        print("请先下载 ecdict.csv 放到本项目根目录")
        print("下载地址: https://github.com/skywind3000/ECDICT/raw/master/ecdict.csv")
        exit(1)
    
    print(f"📖 正在读取本地文件: ecdict.csv")
    with open(filepath, "r", encoding="utf-8") as f:
        data = f.read()
    print(f"    读取完成，共 {len(data.splitlines())} 行")
    return data

def parse_and_extract(csv_text):
    """
    从 CSV 中解析单词，提取 CET4 和 CET6 的单词
    CSV 格式: word, phonetic, definition, translation, pos, collins, oxford, tag, bnc, frq, exchange, detail, audio
    tag 字段包含考试标签，如 'cet4', 'cet6' 等
    """
    print("[2/3] 正在解析并提取四级/六级单词...")
    
    cet4_words = []
    cet6_words = []
    
    reader = csv.DictReader(csv_text.splitlines())
    row_count = 0
    for row in reader:
        row_count += 1
        word = (row.get("word", "") or "").strip()
        translation = (row.get("translation", "") or "").strip()
        tag = (row.get("tag", "") or "").strip().lower()
        
        if not word or not translation:
            continue
        
        # 清理释义
        translation = translation.replace("<br>", "；").replace("<br/>", "；")
        translation = translation.replace("\n", "；").replace("\r", "")
        # 去掉词性前缀
        translation = re.sub(r'^(vt\.|vi\.|n\.|a\.|adv\.|prep\.|v\.|pron\.|conj\.|int\.|art\.|num\.|abbr\.)\s*', '', translation, flags=re.IGNORECASE)
        # 去掉开头结尾的多余空格和符号
        translation = translation.strip().rstrip("；;，,").strip()
        # 限制释义长度
        if len(translation) > 200:
            translation = translation[:200]
        
        # 按标签分类
        tags = tag.split()
        if "cet4" in tags:
            cet4_words.append({
                "word": word,
                "definition": translation,
                "category": "四级",
                "unit": 1
            })
        if "cet6" in tags:
            cet6_words.append({
                "word": word,
                "definition": translation,
                "category": "六级",
                "unit": 1
            })
        
        if row_count % 50000 == 0:
            print(f"    已处理 {row_count} 行...")
    
    print(f"    处理完成！共扫描 {row_count} 行")
    print(f"    提取到 {len(cet4_words)} 个四级单词")
    print(f"    提取到 {len(cet6_words)} 个六级单词")
    return cet4_words, cet6_words

def assign_units(words):
    """按单元分组，每单元 100 词"""
    for i, w in enumerate(words):
        w["unit"] = (i // 100) + 1
    return words

def save_json(words, filename):
    """保存为 JSON 文件"""
    filepath = os.path.join(os.path.dirname(__file__), "assets", filename)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(words, f, ensure_ascii=False, indent=2)
    print(f"    -> 已保存 {filepath} ({len(words)} 个单词)")

def main():
    print("=" * 60)
    print("  WordWiz 词库下载工具")
    print("  数据来源: skywind3000/ECDICT (MIT License)")
    print("=" * 60)
    print()
    
    csv_text = read_local_csv()
    
    cet4, cet6 = parse_and_extract(csv_text)
    
    cet4 = assign_units(cet4)
    cet6 = assign_units(cet6)
    
    print()
    print("[3/3] 正在保存 JSON 文件...")
    
    save_json(cet4, "words_cet4.json")
    save_json(cet6, "words_cet6.json")
    
    print()
    print("=" * 60)
    print("  ✅ 完成！")
    print(f"  四级词库: {len(cet4)} 词，{cet4[-1]['unit'] if cet4 else 0} 单元")
    print(f"  六级词库: {len(cet6)} 词，{cet6[-1]['unit'] if cet6 else 0} 单元")
    print()
    print("  使用方法:")
    print("  1. 启动 WordWiz 服务器")
    print("  2. 进入「设置」页")
    print("  3. 点击「选择文件导入」")
    print("  4. 选择 assets/words_cet4.json 或 words_cet6.json")
    print("=" * 60)

if __name__ == "__main__":
    main()
