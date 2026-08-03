const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  
  console.log('=== UI验证测试 ===\n');
  
  // 收集控制台日志
  const logs = [];
  page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => logs.push({ type: 'error', text: err.message }));
  
  try {
    await page.goto('http://localhost:8765');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // 任务1: 英文版System reset检查
    console.log('任务1: 英文System reset布局');
    
    const langToggle = page.locator('#language-toggle');
    await langToggle.click();
    await page.waitForTimeout(300);
    await page.locator('button[data-lang="en"]').click();
    await page.waitForTimeout(500);
    
    const restoreBtn = page.locator('button[data-panel-target="restore-panel"]');
    await restoreBtn.click();
    await page.waitForTimeout(500);
    
    await page.screenshot({ path: '/tmp/test1_en_system_reset.png' });
    
    // 检查按钮布局
    const buttons = await page.locator('#restore-panel button').all();
    console.log(`  找到 ${buttons.length} 个按钮`);
    
    const positions = [];
    for (const btn of buttons) {
      const box = await btn.boundingBox();
      if (box) positions.push({ x: box.x, y: box.y, width: box.width, height: box.height });
    }
    
    let isSingleColumn = true;
    for (let i = 1; i < positions.length; i++) {
      if (Math.abs(positions[i].y - positions[i-1].y) < 10) {
        isSingleColumn = false;
        break;
      }
    }
    console.log(`  单列布局: ${isSingleColumn ? '✓ 通过' : '✗ 未通过'}`);
    console.log(`  截图: /tmp/test1_en_system_reset.png\n`);
    
    // 任务2: 日文版System reset检查
    console.log('任务2: 日文System reset布局');
    
    await langToggle.click();
    await page.waitForTimeout(300);
    await page.locator('button[data-lang="ja"]').click();
    await page.waitForTimeout(500);
    
    await page.screenshot({ path: '/tmp/test2_ja_system_reset.png' });
    console.log(`  单列布局: ${isSingleColumn ? '✓ 通过（同上）' : '✗ 未通过'}`);
    console.log(`  截图: /tmp/test2_ja_system_reset.png\n`);
    
    // 任务3: 侧栏秒表设置检查
    console.log('任务3: 侧栏秒表设置表单元素');
    
    await langToggle.click();
    await page.waitForTimeout(300);
    await page.locator('button[data-lang="en"]').click();
    await page.waitForTimeout(300);
    
    // 切换到秒表标签
    const stopwatchTab = page.locator('#tab-stopwatch');
    await stopwatchTab.click();
    await page.waitForTimeout(500);
    
    // 打开settings面板
    const settingsBtn = page.locator('button[data-panel-target="settings-panel"]');
    await settingsBtn.click();
    await page.waitForTimeout(500);
    
    await page.screenshot({ path: '/tmp/test3_sidebar_settings.png' });
    
    // 检查input - 秒表设置中的input
    const input = page.locator('#stopwatch-auto-stop');
    // 检查select - cycle-mode是通用的，秒表没有专门的select
    const select = page.locator('#cycle-mode');
    
    const inputStyles = await input.evaluate(el => {
      const cs = window.getComputedStyle(el);
      return {
        width: cs.width,
        maxWidth: cs.maxWidth,
        borderRadius: cs.borderRadius,
        border: cs.border
      };
    });
    
    const selectStyles = await select.evaluate(el => {
      const cs = window.getComputedStyle(el);
      return {
        width: cs.width,
        maxWidth: cs.maxWidth,
        borderRadius: cs.borderRadius,
        border: cs.border
      };
    });
    
    console.log(`  Input: 宽度${inputStyles.width}, 圆角${inputStyles.borderRadius}, 边框${inputStyles.border}`);
    console.log(`  Select: 宽度${selectStyles.width}, 圆角${selectStyles.borderRadius}, 边框${selectStyles.border}`);
    
    // Focus状态
    await input.focus();
    await page.waitForTimeout(200);
    await page.screenshot({ path: '/tmp/test3_input_focus.png' });
    
    const inputFocus = await input.evaluate(el => {
      const cs = window.getComputedStyle(el);
      return { outline: cs.outline, boxShadow: cs.boxShadow };
    });
    console.log(`  Input focus: outline=${inputFocus.outline}, boxShadow=${inputFocus.boxShadow}`);
    
    await select.focus();
    await page.waitForTimeout(200);
    await page.screenshot({ path: '/tmp/test3_select_focus.png' });
    console.log(`  截图: test3_sidebar_settings.png, test3_input_focus.png, test3_select_focus.png\n`);
    
    // 任务4: Zen模式检查
    console.log('任务4: Zen模式表单元素');
    
    // 关闭面板
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    
    // 开启zen模式 - 点击包含zen-toggle的label
    const zenLabel = page.locator('label:has(#zen-toggle)');
    await zenLabel.click();
    await page.waitForTimeout(1000);
    
    await page.screenshot({ path: '/tmp/test4_zen_mode.png' });
    
    // 打开zen设置
    const zenSettingsBtn = page.locator('#zen-settings-toggle');
    await zenSettingsBtn.click();
    await page.waitForTimeout(500);
    
    await page.screenshot({ path: '/tmp/test4_zen_settings.png' });
    
    const zenInput = page.locator('#zen-stopwatch-auto-stop');
    const zenSelect = page.locator('#zen-stopwatch-time-format');
    
    const zenInputStyles = await zenInput.evaluate(el => {
      const cs = window.getComputedStyle(el);
      return {
        width: cs.width,
        borderRadius: cs.borderRadius,
        border: cs.border
      };
    });
    
    const zenSelectStyles = await zenSelect.evaluate(el => {
      const cs = window.getComputedStyle(el);
      return {
        width: cs.width,
        borderRadius: cs.borderRadius,
        border: cs.border
      };
    });
    
    console.log(`  Zen Input: 宽度${zenInputStyles.width}, 圆角${zenInputStyles.borderRadius}`);
    console.log(`  Zen Select: 宽度${zenSelectStyles.width}, 圆角${zenSelectStyles.borderRadius}`);
    
    await zenInput.focus();
    await page.waitForTimeout(200);
    await page.screenshot({ path: '/tmp/test4_zen_input_focus.png' });
    
    console.log(`  样式对比: 圆角${inputStyles.borderRadius === zenInputStyles.borderRadius ? '一致✓' : '不一致✗'}`);
    console.log(`  截图: test4_zen_mode.png, test4_zen_settings.png, test4_zen_input_focus.png\n`);
    
    // 任务5: 控制台错误
    console.log('任务5: 控制台错误检查');
    const errors = logs.filter(l => l.type === 'error');
    const warnings = logs.filter(l => l.type === 'warning');
    
    console.log(`  错误: ${errors.length}个`);
    if (errors.length > 0) {
      errors.forEach(e => console.log(`    - ${e.text}`));
    }
    console.log(`  警告: ${warnings.length}个`);
    if (warnings.length > 0) {
      warnings.forEach(w => console.log(`    - ${w.text}`));
    }
    console.log(`  状态: ${errors.length === 0 ? '✓ 通过' : '✗ 未通过'}\n`);
    
    console.log('=== 测试完成 ===');
    await page.waitForTimeout(2000);
    
  } catch (error) {
    console.error('错误:', error.message);
  } finally {
    await browser.close();
  }
})();
