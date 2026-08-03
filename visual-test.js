const puppeteer = require('puppeteer');
const fs = require('fs');

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function visualTest() {
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 800 }
  });
  
  try {
    const page = await browser.newPage();
    
    // 创建截图目录
    const screenshotDir = './test-screenshots';
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir);
    }
    
    console.log('步骤 1: 打开页面并截图');
    await page.goto('http://localhost:8000', { waitUntil: 'networkidle2' });
    await wait(2000);
    await page.screenshot({ path: `${screenshotDir}/01-initial.png`, fullPage: false });
    
    // 获取初始时间显示
    const initialTime = await page.evaluate(() => {
      // 查找所有文本节点，找到匹配时间格式的
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while (node = walker.nextNode()) {
        const text = node.textContent.trim();
        if (/^\d{2}:\d{2}$/.test(text) && node.parentElement) {
          const style = window.getComputedStyle(node.parentElement);
          const fontSize = parseFloat(style.fontSize);
          // 找到大字体的时间显示（主计时器通常字体很大）
          if (fontSize > 30) {
            return { time: text, fontSize: fontSize };
          }
        }
      }
      return null;
    });
    
    console.log(`步骤 2: 初始时间 = ${initialTime ? initialTime.time : '未找到'} (字体大小: ${initialTime ? initialTime.fontSize : 'N/A'}px)`);
    
    // 步骤 3: 点击开始按钮
    console.log('步骤 3: 点击开始按钮');
    await page.click('#start-work');
    await wait(500);
    await page.screenshot({ path: `${screenshotDir}/02-after-start-click.png` });
    
    // 步骤 4: 等待 3 秒后截图
    console.log('步骤 4: 等待 3 秒观察时间变化');
    await wait(3000);
    await page.screenshot({ path: `${screenshotDir}/03-after-3sec-running.png` });
    
    const timeAfter3Sec = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while (node = walker.nextNode()) {
        const text = node.textContent.trim();
        if (/^\d{2}:\d{2}$/.test(text) && node.parentElement) {
          const style = window.getComputedStyle(node.parentElement);
          const fontSize = parseFloat(style.fontSize);
          if (fontSize > 30) {
            return text;
          }
        }
      }
      return null;
    });
    console.log(`  3秒后时间 = ${timeAfter3Sec}`);
    
    // 步骤 5: 点击暂停按钮
    console.log('步骤 5: 点击暂停按钮');
    await page.click('#pause-resume');
    await wait(500);
    await page.screenshot({ path: `${screenshotDir}/04-after-pause-click.png` });
    
    // 步骤 6: 等待 2 秒确认时间停止
    console.log('步骤 6: 等待 2 秒确认时间停止');
    const timePaused1 = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while (node = walker.nextNode()) {
        const text = node.textContent.trim();
        if (/^\d{2}:\d{2}$/.test(text) && node.parentElement) {
          const style = window.getComputedStyle(node.parentElement);
          const fontSize = parseFloat(style.fontSize);
          if (fontSize > 30) {
            return text;
          }
        }
      }
      return null;
    });
    console.log(`  暂停后立即时间 = ${timePaused1}`);
    
    await wait(2000);
    await page.screenshot({ path: `${screenshotDir}/05-after-2sec-paused.png` });
    
    const timePaused2 = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while (node = walker.nextNode()) {
        const text = node.textContent.trim();
        if (/^\d{2}:\d{2}$/.test(text) && node.parentElement) {
          const style = window.getComputedStyle(node.parentElement);
          const fontSize = parseFloat(style.fontSize);
          if (fontSize > 30) {
            return text;
          }
        }
      }
      return null;
    });
    console.log(`  暂停 2 秒后时间 = ${timePaused2}`);
    
    // 步骤 7: 点击继续/恢复按钮
    console.log('步骤 7: 点击继续/恢复按钮');
    await page.click('#pause-resume');
    await wait(500);
    await page.screenshot({ path: `${screenshotDir}/06-after-resume-click.png` });
    
    // 步骤 8: 等待 2 秒确认时间继续
    console.log('步骤 8: 等待 2 秒确认时间继续');
    await wait(2000);
    await page.screenshot({ path: `${screenshotDir}/07-after-2sec-resumed.png` });
    
    const timeResumed = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while (node = walker.nextNode()) {
        const text = node.textContent.trim();
        if (/^\d{2}:\d{2}$/.test(text) && node.parentElement) {
          const style = window.getComputedStyle(node.parentElement);
          const fontSize = parseFloat(style.fontSize);
          if (fontSize > 30) {
            return text;
          }
        }
      }
      return null;
    });
    console.log(`  恢复 2 秒后时间 = ${timeResumed}`);
    
    // 分析结果
    console.log('\n========== 验证结果 ==========');
    console.log(`初始时间: ${initialTime ? initialTime.time : '未找到'}`);
    console.log(`开始 3 秒后: ${timeAfter3Sec}`);
    console.log(`暂停后立即: ${timePaused1}`);
    console.log(`暂停 2 秒后: ${timePaused2}`);
    console.log(`恢复 2 秒后: ${timeResumed}`);
    
    const started = initialTime && timeAfter3Sec && initialTime.time !== timeAfter3Sec;
    const paused = timePaused1 === timePaused2;
    const resumed = timePaused2 !== timeResumed;
    
    console.log('\n功能验证:');
    console.log(`✓ 开始计时: ${started ? '正常' : '异常'}`);
    console.log(`✓ 暂停功能: ${paused ? '正常' : '异常'}`);
    console.log(`✓ 恢复计时: ${resumed ? '正常' : '异常'}`);
    
    console.log(`\n截图已保存到: ${screenshotDir}/`);
    
    // 保持浏览器打开 5 秒以便查看
    await wait(5000);
    
  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    await browser.close();
  }
}

visualTest();
