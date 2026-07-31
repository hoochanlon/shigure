const puppeteer = require('puppeteer');

const viewports = [
  { name: '1440x900（宽桌面）', width: 1440, height: 900, testZen: true },
  { name: '1200x900（窄桌面）', width: 1200, height: 900, testZen: false },
  { name: '1024x768（平板横屏）', width: 1024, height: 768, testZen: false },
  { name: '768x1024（平板竖屏）', width: 768, height: 1024, testZen: false },
  { name: '430x932（手机）', width: 430, height: 932, testZen: true },
  { name: '320x568（小手机）', width: 320, height: 568, testZen: false },
];

async function testViewport(page, viewport) {
  console.log(`\n========== 测试视口: ${viewport.name} ==========`);
  
  // 1. 设置视口尺寸
  await page.setViewport({ width: viewport.width, height: viewport.height });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForTimeout(500);
  
  // 2. 切换到秒表模式
  await page.click('#tab-stopwatch');
  await page.waitForTimeout(300);
  
  // 3. 设置秒表时间为 99:59:59
  await page.evaluate(() => {
    document.getElementById('stopwatch-time').textContent = '99:59:59';
  });
  await page.waitForTimeout(200);
  
  // 4. 执行测量 JS
  const measurements = await page.evaluate(() => {
    const stopwatchTime = document.getElementById('stopwatch-time');
    const timerStage = document.querySelector('.timer-stage');
    const result = {
      stopwatchTime_clientWidth: stopwatchTime.clientWidth,
      stopwatchTime_scrollWidth: stopwatchTime.scrollWidth,
      stopwatchTime_rect: stopwatchTime.getBoundingClientRect(),
      timerStage_rect: timerStage.getBoundingClientRect(),
      doc_scrollWidth: document.documentElement.scrollWidth,
      window_innerWidth: window.innerWidth,
      isOverflow: stopwatchTime.getBoundingClientRect().width > timerStage.getBoundingClientRect().width
    };
    return result;
  });
  
  console.log('秒表测量结果:');
  console.log(`  stopwatchTime clientWidth: ${measurements.stopwatchTime_clientWidth}`);
  console.log(`  stopwatchTime scrollWidth: ${measurements.stopwatchTime_scrollWidth}`);
  console.log(`  stopwatchTime rect.width: ${measurements.stopwatchTime_rect.width.toFixed(2)}`);
  console.log(`  timerStage rect.width: ${measurements.timerStage_rect.width.toFixed(2)}`);
  console.log(`  isOverflow: ${measurements.isOverflow ? 'Y' : 'N'}`);
  console.log(`  doc.scrollWidth: ${measurements.doc_scrollWidth}, window.innerWidth: ${measurements.window_innerWidth}`);
  
  // 5. 切换到番茄钟模式，检查是否显示 25:00
  await page.click('#tab-pomodoro');
  await page.waitForTimeout(300);
  
  const pomodoroTime = await page.evaluate(() => {
    return document.getElementById('pomodoro-time').textContent;
  });
  console.log(`番茄钟显示: ${pomodoroTime} (预期: 25:00)`);
  
  // 6. 对特定视口测试禅模式
  let zenResult = null;
  if (viewport.testZen) {
    await page.click('#zen-toggle');
    await page.waitForTimeout(500);
    
    const zenActive = await page.evaluate(() => {
      return document.body.classList.contains('zen-mode');
    });
    
    const zenLayout = await page.evaluate(() => {
      const timer = document.querySelector('.timer');
      const controls = document.querySelector('.controls');
      return {
        timerVisible: timer && window.getComputedStyle(timer).display !== 'none',
        controlsVisible: controls && window.getComputedStyle(controls).display !== 'none',
        zenModeActive: document.body.classList.contains('zen-mode')
      };
    });
    
    console.log(`禅模式测试: 激活=${zenActive}, 布局正常=${zenLayout.timerVisible && !zenLayout.controlsVisible}`);
    zenResult = { active: zenActive, layoutOk: zenLayout.timerVisible && !zenLayout.controlsVisible };
    
    // 关闭禅模式
    await page.click('#zen-toggle');
    await page.waitForTimeout(300);
  }
  
  return {
    viewport: viewport.name,
    stopwatchTime_clientWidth: measurements.stopwatchTime_clientWidth,
    stopwatchTime_scrollWidth: measurements.stopwatchTime_scrollWidth,
    stopwatchTime_rectWidth: measurements.stopwatchTime_rect.width.toFixed(2),
    timerStage_rectWidth: measurements.timerStage_rect.width.toFixed(2),
    isOverflow: measurements.isOverflow ? 'Y' : 'N',
    docScrollWidth: measurements.doc_scrollWidth,
    windowInnerWidth: measurements.window_innerWidth,
    pomodoroDisplay: pomodoroTime,
    pomodoroOk: pomodoroTime === '25:00' ? 'Y' : 'N',
    zenTest: zenResult ? `激活=${zenResult.active}, 布局=${zenResult.layoutOk ? 'OK' : 'NG'}` : 'N/A'
  };
}

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:8000', { waitUntil: 'networkidle0' });
    
    const results = [];
    for (const viewport of viewports) {
      const result = await testViewport(page, viewport);
      results.push(result);
    }
    
    console.log('\n\n========== 测试结果汇总表 ==========\n');
    console.table(results);
    
  } catch (error) {
    console.error('测试出错:', error);
  } finally {
    await browser.close();
  }
})();
