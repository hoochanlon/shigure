const puppeteer = require('puppeteer');
const fs = require('fs');

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function cssValidationTest() {
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 800 }
  });
  
  const results = {
    consoleErrors: [],
    test1: { name: 'English 系统重置单列布局', passed: false, details: '' },
    test2: { name: 'Japanese 系统重置单列布局', passed: false, details: '' },
    test3: { name: '侧栏秒表设置样式', passed: false, details: '' },
    test4: { name: 'Zen 秒表样式一致性', passed: false, details: '' }
  };
  
  try {
    const page = await browser.newPage();
    
    // 监听控制台错误
    page.on('console', msg => {
      if (msg.type() === 'error') {
        results.consoleErrors.push(msg.text());
      }
    });
    
    page.on('pageerror', error => {
      results.consoleErrors.push(error.message);
    });
    
    console.log('打开页面 http://localhost:9000');
    await page.goto('http://localhost:9000', { waitUntil: 'networkidle2' });
    await wait(2000);
    
    // 测试 1: 切换到 English，检查系统重置单列布局
    console.log('\n测试 1: English 系统重置单列布局');
    
    // 找到并点击语言切换按钮
    await page.click('#language-toggle');
    await wait(500);
    
    // 选择 English
    const englishOption = await page.$('button[data-lang="en"]');
    if (englishOption) {
      await page.click('button[data-lang="en"]');
      await wait(1000);
    }
    
    // 打开设置面板
    const settingsButton = await page.$('button[data-panel-target="settings-panel"]');
    if (settingsButton) {
      await page.click('button[data-panel-target="settings-panel"]');
      await wait(500);
    }
    
    // 点击系统重置展开按钮
    const restoreButton = await page.$('button[data-panel-target="restore-panel"]');
    if (restoreButton) {
      await page.click('button[data-panel-target="restore-panel"]');
      await wait(500);
    }
    
    const resetStyles = await page.evaluate(() => {
      // 查找重置选项容器
      const restorePanel = document.querySelector('#restore-panel');
      if (!restorePanel) return { found: false, reason: 'restore-panel not found' };
      
      const isHidden = restorePanel.hasAttribute('hidden');
      if (isHidden) return { found: false, reason: 'restore-panel is hidden' };
      
      const settingsGrid = restorePanel.querySelector('.settings-grid');
      if (!settingsGrid) return { found: false, reason: 'settings-grid not found' };
      
      const computed = window.getComputedStyle(settingsGrid);
      const columnCount = computed.columnCount || computed.webkitColumnCount || '1';
      const display = computed.display;
      const flexDirection = computed.flexDirection;
      const gridTemplateColumns = computed.gridTemplateColumns;
      
      return {
        found: true,
        columnCount,
        display,
        flexDirection,
        gridTemplateColumns,
        width: settingsGrid.offsetWidth,
        height: settingsGrid.offsetHeight
      };
    });
    
    if (resetStyles.found) {
      const isSingleColumn = resetStyles.columnCount === '1' || 
                            resetStyles.columnCount === 'auto' ||
                            resetStyles.flexDirection === 'column' ||
                            resetStyles.gridTemplateColumns === 'none' ||
                            !resetStyles.gridTemplateColumns.includes(' ');
      results.test1.passed = isSingleColumn;
      results.test1.details = JSON.stringify(resetStyles);
    } else {
      results.test1.details = resetStyles.reason || '未找到重置展开区域';
    }
    
    await page.screenshot({ path: './test-screenshots/css-test-1-english.png' });
    
    // 测试 2: 切换到 Japanese，检查系统重置单列布局
    console.log('\n测试 2: Japanese 系统重置单列布局');
    
    await page.click('#language-toggle');
    await wait(500);
    const japaneseOption = await page.$('button[data-lang="ja"]');
    if (japaneseOption) {
      await page.click('button[data-lang="ja"]');
      await wait(1000);
    }
    
    // 重新打开设置面板和 restore-panel（因为切换语言可能关闭了面板）
    const settingsButton3 = await page.$('button[data-panel-target="settings-panel"]');
    if (settingsButton3) {
      await page.click('button[data-panel-target="settings-panel"]');
      await wait(500);
    }
    
    const restoreButton2 = await page.$('button[data-panel-target="restore-panel"]');
    if (restoreButton2) {
      await page.click('button[data-panel-target="restore-panel"]');
      await wait(500);
    }
    
    const resetStylesJa = await page.evaluate(() => {
      const restorePanel = document.querySelector('#restore-panel');
      if (!restorePanel) return { found: false, reason: 'restore-panel not found' };
      
      const isHidden = restorePanel.hasAttribute('hidden');
      if (isHidden) return { found: false, reason: 'restore-panel is hidden' };
      
      const settingsGrid = restorePanel.querySelector('.settings-grid');
      if (!settingsGrid) return { found: false, reason: 'settings-grid not found' };
      
      const computed = window.getComputedStyle(settingsGrid);
      return {
        found: true,
        columnCount: computed.columnCount || computed.webkitColumnCount || '1',
        display: computed.display,
        flexDirection: computed.flexDirection,
        gridTemplateColumns: computed.gridTemplateColumns
      };
    });
    
    if (resetStylesJa.found) {
      const isSingleColumn = resetStylesJa.columnCount === '1' || 
                            resetStylesJa.columnCount === 'auto' ||
                            resetStylesJa.flexDirection === 'column' ||
                            resetStylesJa.gridTemplateColumns === 'none' ||
                            !resetStylesJa.gridTemplateColumns.includes(' ');
      results.test2.passed = isSingleColumn;
      results.test2.details = JSON.stringify(resetStylesJa);
    } else {
      results.test2.details = resetStylesJa.reason || '未找到重置展开区域';
    }
    
    await page.screenshot({ path: './test-screenshots/css-test-2-japanese.png' });
    
    // 关闭设置面板
    const closeSettings = await page.$('button[data-panel-target="settings-panel"]');
    if (closeSettings) {
      await page.click('button[data-panel-target="settings-panel"]');
      await wait(500);
    }
    
    // 测试 3: 秒表设置样式
    console.log('\n测试 3: 侧栏秒表设置样式');
    
    // 切换到秒表视图
    await page.click('#tab-stopwatch');
    await wait(500);
    
    // 打开设置（如果之前关闭了）
    const settingsPanel = await page.$('#settings-panel[hidden]');
    if (settingsPanel) {
      const settingsButton2 = await page.$('button[data-panel-target="settings-panel"]');
      if (settingsButton2) {
        await page.click('button[data-panel-target="settings-panel"]');
        await wait(800);
      }
    }
    
    const stopwatchInputStyles = await page.evaluate(() => {
      const settingsPanel = document.querySelector('#settings-panel');
      if (!settingsPanel) return { error: 'settings-panel not found' };
      
      const isHidden = settingsPanel.hasAttribute('hidden');
      if (isHidden) return { error: 'settings-panel is hidden' };
      
      const sidebarWidth = settingsPanel.offsetWidth;
      
      const stopwatchSettings = document.querySelector('#stopwatch-settings');
      if (!stopwatchSettings) return { error: 'stopwatch-settings not found' };
      
      const isStopwatchHidden = stopwatchSettings.hasAttribute('hidden');
      if (isStopwatchHidden) return { error: 'stopwatch-settings is hidden' };
      
      const inputs = stopwatchSettings.querySelectorAll('input[type="text"], input[type="number"]');
      const selects = stopwatchSettings.querySelectorAll('select');
      
      const inputStyles = Array.from(inputs).map(input => {
        const computed = window.getComputedStyle(input);
        const rect = input.getBoundingClientRect();
        const actualWidth = input.offsetWidth || rect.width;
        return {
          width: actualWidth,
          widthPercent: sidebarWidth > 0 ? (actualWidth / sidebarWidth * 100).toFixed(2) + '%' : 'N/A',
          borderRadius: computed.borderRadius,
          border: computed.border,
          borderWidth: computed.borderWidth
        };
      });
      
      const selectStyles = Array.from(selects).map(select => {
        const computed = window.getComputedStyle(select);
        const rect = select.getBoundingClientRect();
        const actualWidth = select.offsetWidth || rect.width;
        return {
          width: actualWidth,
          widthPercent: sidebarWidth > 0 ? (actualWidth / sidebarWidth * 100).toFixed(2) + '%' : 'N/A',
          borderRadius: computed.borderRadius,
          border: computed.border,
          borderWidth: computed.borderWidth
        };
      });
      
      return { sidebarWidth, inputStyles, selectStyles };
    });
    
    // 检查 focus 样式
    if (stopwatchInputStyles.inputStyles && stopwatchInputStyles.inputStyles.length > 0) {
      const firstInput = await page.$('#stopwatch-settings input[type="text"], #stopwatch-settings input[type="number"]');
      if (firstInput) {
        await firstInput.focus();
        await wait(200);
      }
      
      const focusStyles = await page.evaluate(() => {
        const input = document.querySelector('#stopwatch-settings input[type="text"]:focus, #stopwatch-settings input[type="number"]:focus');
        if (input) {
          const computed = window.getComputedStyle(input);
          return {
            outline: computed.outline,
            outlineWidth: computed.outlineWidth,
            outlineColor: computed.outlineColor,
            boxShadow: computed.boxShadow
          };
        }
        return null;
      });
      
      stopwatchInputStyles.focusStyles = focusStyles;
    }
    
    // 验证：宽度不撑满（< 95%），有圆角（> 0px），有边框（> 0px），有 focus 样式
    const hasConstrainedWidth = stopwatchInputStyles.inputStyles && stopwatchInputStyles.inputStyles.some(s => 
      parseFloat(s.widthPercent) < 95
    );
    const hasBorderRadius = stopwatchInputStyles.inputStyles && stopwatchInputStyles.inputStyles.some(s => 
      s.borderRadius && s.borderRadius !== '0px'
    );
    const hasBorder = stopwatchInputStyles.inputStyles && stopwatchInputStyles.inputStyles.some(s => 
      s.borderWidth && s.borderWidth !== '0px'
    );
    const hasFocusStyle = stopwatchInputStyles.focusStyles && 
      (stopwatchInputStyles.focusStyles.outlineWidth !== '0px' || 
       stopwatchInputStyles.focusStyles.boxShadow !== 'none');
    
    results.test3.passed = hasConstrainedWidth && hasBorderRadius && hasBorder && hasFocusStyle;
    results.test3.details = JSON.stringify(stopwatchInputStyles, null, 2);
    
    await page.screenshot({ path: './test-screenshots/css-test-3-stopwatch.png' });
    
    // 测试 4: Zen 模式样式一致性
    console.log('\n测试 4: Zen 秒表样式一致性');
    
    // 开启 Zen 模式
    await page.click('#zen-toggle');
    await wait(1000);
    
    const zenInputStyles = await page.evaluate(() => {
      const zenSettings = document.querySelector('.zen-stopwatch-settings, #stopwatch-settings');
      if (!zenSettings) return { error: 'zen settings not found' };
      
      const inputs = zenSettings.querySelectorAll('input[type="text"], input[type="number"]');
      const selects = zenSettings.querySelectorAll('select');
      
      const inputStyles = Array.from(inputs).slice(0, 2).map(input => {
        const computed = window.getComputedStyle(input);
        const rect = input.getBoundingClientRect();
        return {
          width: rect.width,
          borderRadius: computed.borderRadius,
          border: computed.border,
          borderWidth: computed.borderWidth,
          fontSize: computed.fontSize,
          padding: computed.padding
        };
      });
      
      const selectStyles = Array.from(selects).slice(0, 2).map(select => {
        const computed = window.getComputedStyle(select);
        const rect = select.getBoundingClientRect();
        return {
          width: rect.width,
          borderRadius: computed.borderRadius,
          border: computed.border,
          borderWidth: computed.borderWidth,
          fontSize: computed.fontSize,
          padding: computed.padding
        };
      });
      
      return { inputStyles, selectStyles };
    });
    
    // 比较 zen 和 sidebar 样式的一致性
    const stylesMatch = 
      zenInputStyles.inputStyles && zenInputStyles.inputStyles.length > 0 && 
      stopwatchInputStyles.inputStyles && stopwatchInputStyles.inputStyles.length > 0 &&
      zenInputStyles.inputStyles[0].borderRadius === stopwatchInputStyles.inputStyles[0].borderRadius &&
      zenInputStyles.inputStyles[0].borderWidth === stopwatchInputStyles.inputStyles[0].borderWidth;
    
    results.test4.passed = stylesMatch;
    results.test4.details = JSON.stringify(zenInputStyles, null, 2);
    
    await page.screenshot({ path: './test-screenshots/css-test-4-zen.png' });
    
    console.log('\n========== 测试结果 ==========');
    console.log('\n控制台错误:', results.consoleErrors.length === 0 ? '无' : results.consoleErrors.join('\n'));
    console.log('\n测试 1 -', results.test1.name, ':', results.test1.passed ? '✓ 通过' : '✗ 失败');
    console.log('详情:', results.test1.details);
    console.log('\n测试 2 -', results.test2.name, ':', results.test2.passed ? '✓ 通过' : '✗ 失败');
    console.log('详情:', results.test2.details);
    console.log('\n测试 3 -', results.test3.name, ':', results.test3.passed ? '✓ 通过' : '✗ 失败');
    console.log('详情:', results.test3.details);
    console.log('\n测试 4 -', results.test4.name, ':', results.test4.passed ? '✓ 通过' : '✗ 失败');
    console.log('详情:', results.test4.details);
    
    await wait(3000);
    
  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    await browser.close();
  }
}

cssValidationTest();
