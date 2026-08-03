const puppeteer = require('puppeteer');
const fs = require('fs');

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function stopwatchTest() {
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 800 }
  });
  
  try {
    const page = await browser.newPage();
    
    const screenshotDir = './test-screenshots';
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir);
    }
    
    console.log('打开页面');
    await page.goto('http://localhost:8000', { waitUntil: 'networkidle2' });
    await wait(2000);
    
    // 步骤 1: 切换到秒表视图
    console.log('步骤 1: 切换到秒表视图');
    await page.click('#tab-stopwatch');
    await wait(1000);
    await page.screenshot({ path: `${screenshotDir}/stopwatch-01-view-switched.png` });
    
    // 步骤 2: 记录初始时间
    const getStopwatchTime = async () => {
      return await page.evaluate(() => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node;
        while (node = walker.nextNode()) {
          const text = node.textContent.trim();
          // 匹配秒表格式 HH:MM.SS 或 MM:SS.SS
          if (/^\d{2}:\d{2}\.\d{2}$/.test(text) && node.parentElement) {
            const style = window.getComputedStyle(node.parentElement);
            const fontSize = parseFloat(style.fontSize);
            if (fontSize > 30) {
              return text;
            }
          }
        }
        return null;
      });
    };
    
    const initialTime = await getStopwatchTime();
    console.log(`步骤 2: 初始时间 = ${initialTime}`);
    await page.screenshot({ path: `${screenshotDir}/stopwatch-02-initial.png` });
    
    // 步骤 3: 点击开始按钮
    console.log('步骤 3: 点击秒表开始按钮');
    await page.click('#stopwatch-start');
    await wait(500);
    await page.screenshot({ path: `${screenshotDir}/stopwatch-03-after-start.png` });
    
    // 步骤 4: 等待 3 秒观察时间增加
    console.log('步骤 4: 等待 3 秒观察时间变化');
    await wait(3000);
    const timeAfter3Sec = await getStopwatchTime();
    console.log(`  3秒后时间 = ${timeAfter3Sec}`);
    await page.screenshot({ path: `${screenshotDir}/stopwatch-04-after-3sec.png` });
    
    // 步骤 5: 点击停止按钮
    console.log('步骤 5: 点击停止按钮');
    await page.click('#stopwatch-stop');
    await wait(500);
    const timeStopped1 = await getStopwatchTime();
    console.log(`  停止后立即时间 = ${timeStopped1}`);
    await page.screenshot({ path: `${screenshotDir}/stopwatch-05-after-stop.png` });
    
    // 步骤 6: 等待 2 秒确认时间停止
    console.log('步骤 6: 等待 2 秒确认时间停止');
    await wait(2000);
    const timeStopped2 = await getStopwatchTime();
    console.log(`  停止 2 秒后时间 = ${timeStopped2}`);
    await page.screenshot({ path: `${screenshotDir}/stopwatch-06-after-2sec-stopped.png` });
    
    // 分析结果
    console.log('\n========== 秒表验证结果 ==========');
    console.log(`初始时间: ${initialTime}`);
    console.log(`开始 3 秒后: ${timeAfter3Sec}`);
    console.log(`停止后立即: ${timeStopped1}`);
    console.log(`停止 2 秒后: ${timeStopped2}`);
    
    const started = initialTime !== timeAfter3Sec;
    const stopped = timeStopped1 === timeStopped2;
    
    console.log('\n功能验证:');
    console.log(`✓ 开始计时: ${started ? '正常（时间增加）' : '异常'}`);
    console.log(`✓ 停止功能: ${stopped ? '正常（时间冻结）' : '异常'}`);
    
    console.log(`\n截图已保存到: ${screenshotDir}/`);
    
    await wait(3000);
    
  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    await browser.close();
  }
}

stopwatchTest();
