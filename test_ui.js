const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  
  console.log('=== 开始UI验证测试 ===\n');
  
  try {
    // 访问页面
    await page.goto('http://localhost:8765');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // 任务1: 英文版System reset单列布局检查
    console.log('任务1: 英文版System reset单列布局检查');
    
    // 切换到英文
    const langToggle = page.locator('#language-toggle');
    await langToggle.click();
    await page.waitForTimeout(300);
    const langEnBtn = page.locator('button[data-lang="en"]');
    await langEnBtn.click();
    await page.waitForTimeout(500);
    
    // 打开System reset面板（restore-panel）
    const restoreBtn = page.locator('button[data-panel-target="restore-panel"]');
    await restoreBtn.click();
    await page.waitForTimeout(500);
    
    // 找到并展开System reset details
    const systemResetDetails = page.locator('#reset-controls');
    await systemResetDetails.evaluate(el => el.open = true);
    await page.waitForTimeout(300);
    
    await page.screenshot({ path: '/tmp/test1_en_system_reset.png', fullPage: false });
    
    // 检查布局
    const resetButtons = await systemResetDetails.first().locator('button').all();
    console.log(`  - 找到 ${resetButtons.length} 个按钮`);
    
    const buttonsInfo = [];
    for (const btn of resetButtons) {
      const box = await btn.boundingBox();
      if (box) buttonsInfo.push({ y: box.y, height: box.height });
    }
    
    // 判断是否单列（纵向排列）
    let isSingleColumn = true;
    for (let i = 1; i < buttonsInfo.length; i++) {
      if (buttonsInfo[i].y <= buttonsInfo[i-1].y + buttonsInfo[i-1].height / 2) {
        isSingleColumn = false;
        break;
      }
    }
    console.log(`  - 单列布局: ${isSingleColumn ? '通过 ✓' : '未通过 ✗'}`);
    console.log(`  - 截图: /tmp/test1_en_system_reset.png\n`);
    
    // 任务2: 日文版系统重置单列布局检查
    console.log('任务2: 日文版系统重置单列布局检查');
    
    // 切换到日文
    await langToggle.click();
    await page.waitForTimeout(300);
    const langJaBtn = page.locator('button[data-lang="ja"]');
    await langJaBtn.click();
    await page.waitForTimeout(500);
    
    const systemResetDetailsJa = page.locator('#reset-controls');
    await systemResetDetailsJa.evaluate(el => el.open = true);
    await page.waitForTimeout(300);
    
    await page.screenshot({ path: '/tmp/test2_ja_system_reset.png', fullPage: false });
    
    const resetButtonsJa = await systemResetDetailsJa.first().locator('button').all();
    console.log(`  - 找到 ${resetButtonsJa.length} 个按钮`);
    
    const buttonsInfoJa = [];
    for (const btn of resetButtonsJa) {
      const box = await btn.boundingBox();
      if (box) buttonsInfoJa.push({ y: box.y, height: box.height });
    }
    
    let isSingleColumnJa = true;
    for (let i = 1; i < buttonsInfoJa.length; i++) {
      if (buttonsInfoJa[i].y <= buttonsInfoJa[i-1].y + buttonsInfoJa[i-1].height / 2) {
        isSingleColumnJa = false;
        break;
      }
    }
    console.log(`  - 单列布局: ${isSingleColumnJa ? '通过 ✓' : '未通过 ✗'}`);
    console.log(`  - 截图: /tmp/test2_ja_system_reset.png\n`);
    
    // 任务3: 侧栏秒表设置表单元素检查
    console.log('任务3: 侧栏秒表设置表单元素检查');
    
    // 切回英文
    await langToggle.click();
    await page.waitForTimeout(300);
    await langEnBtn.click();
    await page.waitForTimeout(500);
    
    // 打开设置面板
    const settingsBtn = page.locator('button[data-panel-target="settings-panel"]');
    await settingsBtn.click();
    await page.waitForTimeout(500);
    
    // 切换到秒表模式（如果有模式切换）
    const stopwatchModeBtn = page.locator('button[data-mode="stopwatch"]');
    if (await stopwatchModeBtn.count() > 0) {
      await stopwatchModeBtn.click();
      await page.waitForTimeout(300);
    }
    
    // 找到秒表设置中的input和select
    const textInput = page.locator('#stopwatch-auto-stop');
    const selectElem = page.locator('#stopwatch-unit');
    
    await page.screenshot({ path: '/tmp/test3_sidebar_inputs.png', fullPage: false });
    
    // 检查样式
    const inputStyles = await textInput.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        width: computed.width,
        borderRadius: computed.borderRadius,
        border: computed.border,
        maxWidth: computed.maxWidth
      };
    });
    
    const selectStyles = await selectElem.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        width: computed.width,
        borderRadius: computed.borderRadius,
        border: computed.border,
        maxWidth: computed.maxWidth
      };
    });
    
    console.log('  Text Input:');
    console.log(`    - 宽度: ${inputStyles.width} (maxWidth: ${inputStyles.maxWidth})`);
    console.log(`    - 圆角: ${inputStyles.borderRadius}`);
    console.log(`    - 边框: ${inputStyles.border}`);
    
    console.log('  Select:');
    console.log(`    - 宽度: ${selectStyles.width} (maxWidth: ${selectStyles.maxWidth})`);
    console.log(`    - 圆角: ${selectStyles.borderRadius}`);
    console.log(`    - 边框: ${selectStyles.border}`);
    
    // Focus状态
    await textInput.focus();
    await page.waitForTimeout(200);
    await page.screenshot({ path: '/tmp/test3_input_focus.png', fullPage: false });
    
    const inputFocusStyles = await textInput.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        outline: computed.outline,
        boxShadow: computed.boxShadow,
        border: computed.border
      };
    });
    console.log('  Text Input Focus:');
    console.log(`    - outline: ${inputFocusStyles.outline}`);
    console.log(`    - boxShadow: ${inputFocusStyles.boxShadow}`);
    
    await selectElem.focus();
    await page.waitForTimeout(200);
    await page.screenshot({ path: '/tmp/test3_select_focus.png', fullPage: false });
    console.log(`  - 截图: /tmp/test3_sidebar_inputs.png, /tmp/test3_input_focus.png, /tmp/test3_select_focus.png\n`);
    
    // 任务4: Zen模式对比
    console.log('任务4: Zen模式表单元素对比');
    
    // 关闭侧栏
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    
    // 进入Zen模式 - 在environment-panel中
    const zenToggle = page.locator('#zen-toggle');
    await zenToggle.check();
    await page.waitForTimeout(1000);
    
    // 切换到秒表模式
    const zenStopwatchBtn = page.locator('button[data-mode="stopwatch"]');
    if (await zenStopwatchBtn.count() > 0) {
      await zenStopwatchBtn.click();
      await page.waitForTimeout(500);
    }
    
    // 在Zen模式下的秒表设置
    const zenTextInput = page.locator('#zen-stopwatch-settings input[type="text"]').first();
    const zenSelect = page.locator('#zen-stopwatch-settings select').first();
    
    await page.screenshot({ path: '/tmp/test4_zen_inputs.png', fullPage: false });
    
    const zenInputStyles = await zenTextInput.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        width: computed.width,
        borderRadius: computed.borderRadius,
        border: computed.border,
        maxWidth: computed.maxWidth
      };
    });
    
    const zenSelectStyles = await zenSelect.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        width: computed.width,
        borderRadius: computed.borderRadius,
        border: computed.border,
        maxWidth: computed.maxWidth
      };
    });
    
    console.log('  Zen Text Input:');
    console.log(`    - 宽度: ${zenInputStyles.width} (maxWidth: ${zenInputStyles.maxWidth})`);
    console.log(`    - 圆角: ${zenInputStyles.borderRadius}`);
    console.log(`    - 边框: ${zenInputStyles.border}`);
    
    console.log('  Zen Select:');
    console.log(`    - 宽度: ${zenSelectStyles.width} (maxWidth: ${zenSelectStyles.maxWidth})`);
    console.log(`    - 圆角: ${zenSelectStyles.borderRadius}`);
    console.log(`    - 边框: ${zenSelectStyles.border}`);
    
    await zenTextInput.focus();
    await page.waitForTimeout(200);
    await page.screenshot({ path: '/tmp/test4_zen_input_focus.png', fullPage: false });
    
    const zenInputFocusStyles = await zenTextInput.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        outline: computed.outline,
        boxShadow: computed.boxShadow
      };
    });
    console.log('  Zen Input Focus:');
    console.log(`    - outline: ${zenInputFocusStyles.outline}`);
    console.log(`    - boxShadow: ${zenInputFocusStyles.boxShadow}`);
    
    // 对比一致性
    const stylesMatch = 
      inputStyles.borderRadius === zenInputStyles.borderRadius &&
      selectStyles.borderRadius === zenSelectStyles.borderRadius;
    
    console.log(`  - 样式一致性: ${stylesMatch ? '通过 ✓' : '需人工对比'}`);
    console.log(`  - 截图: /tmp/test4_zen_inputs.png, /tmp/test4_zen_input_focus.png\n`);
    
    // 任务5: 控制台错误检查
    console.log('任务5: 浏览器控制台错误检查');
    
    const logs = [];
    page.on('console', msg => {
      logs.push({ type: msg.type(), text: msg.text() });
    });
    
    page.on('pageerror', err => {
      console.log(`  ✗ Error: ${err.message}`);
    });
    
    // 等待收集日志
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    const errors = logs.filter(l => l.type === 'error');
    const warnings = logs.filter(l => l.type === 'warning');
    
    console.log(`  - 错误数量: ${errors.length}`);
    console.log(`  - 警告数量: ${warnings.length}`);
    
    if (errors.length > 0) {
      console.log('  错误列表:');
      errors.forEach(e => console.log(`    - ${e.text}`));
    }
    
    if (warnings.length > 0) {
      console.log('  警告列表:');
      warnings.forEach(w => console.log(`    - ${w.text}`));
    }
    
    console.log(`  - 状态: ${errors.length === 0 ? '通过 ✓' : '未通过 ✗'}\n`);
    
    console.log('=== 测试完成 ===');
    
  } catch (error) {
    console.error('测试执行错误:', error.message);
  } finally {
    await browser.close();
  }
})();
