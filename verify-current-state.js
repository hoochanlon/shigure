const puppeteer = require('puppeteer');

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function verifyCurrentState() {
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox'],
    defaultViewport: { width: 1280, height: 800 }
  });
  
  try {
    const page = await browser.newPage();
    const consoleErrors = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', error => consoleErrors.push(error.message));
    
    await page.goto('http://localhost:9000', { waitUntil: 'networkidle2' });
    await wait(1000);
    
    // 切换到 English
    await page.click('#language-toggle');
    await wait(300);
    await page.click('button[data-lang="en"]');
    await wait(800);
    
    // 切换到秒表视图
    await page.click('#tab-stopwatch');
    await wait(500);
    
    // 打开设置
    await page.click('button[data-panel-target="settings-panel"]');
    await wait(800);
    
    // 获取秒表设置的 input/select 宽度
    const stopwatchData = await page.evaluate(() => {
      const panel = document.querySelector('#settings-panel');
      const panelWidth = panel ? panel.offsetWidth : 0;
      
      const stopwatchSettings = document.querySelector('#stopwatch-settings');
      const inputs = stopwatchSettings ? stopwatchSettings.querySelectorAll('input[type="text"], input[type="number"]') : [];
      const selects = stopwatchSettings ? stopwatchSettings.querySelectorAll('select') : [];
      
      return {
        panelWidth,
        inputs: Array.from(inputs).map(el => ({
          width: el.offsetWidth,
          percent: panelWidth > 0 ? ((el.offsetWidth / panelWidth) * 100).toFixed(2) + '%' : 'N/A'
        })),
        selects: Array.from(selects).map(el => ({
          width: el.offsetWidth,
          percent: panelWidth > 0 ? ((el.offsetWidth / panelWidth) * 100).toFixed(2) + '%' : 'N/A'
        }))
      };
    });
    
    // 打开系统重置检查单列布局
    await page.click('button[data-panel-target="restore-panel"]');
    await wait(500);
    
    const resetData = await page.evaluate(() => {
      const restorePanel = document.querySelector('#restore-panel');
      const grid = restorePanel ? restorePanel.querySelector('.settings-grid') : null;
      
      if (!grid) return { found: false };
      
      const style = window.getComputedStyle(grid);
      return {
        found: true,
        gridTemplateColumns: style.gridTemplateColumns,
        columnCount: style.columnCount
      };
    });
    
    console.log('\n========== 验证结果 ==========\n');
    console.log('控制台错误:', consoleErrors.length === 0 ? '无' : consoleErrors.join('; '));
    console.log('\n秒表设置表单宽度:');
    console.log('  侧栏宽度:', stopwatchData.panelWidth + 'px');
    console.log('  Text inputs:', stopwatchData.inputs.map(i => `${i.width}px (${i.percent})`).join(', '));
    console.log('  Selects:', stopwatchData.selects.map(s => `${s.width}px (${s.percent})`).join(', '));
    console.log('\n系统重置布局:');
    console.log('  单列:', resetData.found && resetData.gridTemplateColumns && !resetData.gridTemplateColumns.includes(' ') ? '✓ 是' : '✗ 否');
    console.log('  gridTemplateColumns:', resetData.gridTemplateColumns);
    
    await wait(2000);
    
  } catch (error) {
    console.error('验证失败:', error.message);
  } finally {
    await browser.close();
  }
}

verifyCurrentState();
