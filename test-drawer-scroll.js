const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: { width: 1280, height: 800 }
  });
  
  const page = await browser.newPage();
  const results = {};
  
  try {
    // 步骤1: 打开页面
    console.log('步骤1: 打开 http://localhost:8000');
    await page.goto('http://localhost:8000', { waitUntil: 'networkidle2' });
    results.step1 = '成功 - 页面已加载';
    
    // 步骤2: 检查并添加待办事项
    console.log('步骤2: 检查待办事项数量');
    const todoCount = await page.evaluate(() => {
      return document.querySelectorAll('.todo-item').length;
    });
    console.log(`当前待办事项数量: ${todoCount}`);
    
    if (todoCount < 10) {
      const needToAdd = 12 - todoCount;
      console.log(`需要添加 ${needToAdd} 个待办事项`);
      for (let i = 0; i < needToAdd; i++) {
        await page.type('#new-todo', `测试待办事项 ${i + 1}`);
        await page.click('#add-todo-btn');
        await page.waitForTimeout(100);
      }
      results.step2 = `成功 - 添加了 ${needToAdd} 个待办事项`;
    } else {
      results.step2 = `成功 - 已有 ${todoCount} 个待办事项`;
    }
    
    // 步骤3: 滚动到中间位置并记录 scrollY
    console.log('步骤3: 滚动到400px位置');
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(500);
    const scrollY_before = await page.evaluate(() => window.scrollY);
    console.log(`scrollY_before = ${scrollY_before}`);
    results.scrollY_before = scrollY_before;
    results.step3 = `成功 - scrollY_before = ${scrollY_before}`;
    
    // 步骤4: 点击"完成记录"按钮
    console.log('步骤4: 点击完成记录按钮');
    await page.click('#completed-drawer-toggle');
    await page.waitForTimeout(500);
    results.step4 = '成功 - 已点击完成记录按钮';
    
    // 步骤5: 抽屉打开后检查 scrollY
    console.log('步骤5: 检查抽屉打开后的 scrollY');
    const scrollY_drawer_open = await page.evaluate(() => window.scrollY);
    console.log(`scrollY_drawer_open = ${scrollY_drawer_open}`);
    results.scrollY_drawer_open = scrollY_drawer_open;
    results.step5 = `成功 - scrollY_drawer_open = ${scrollY_drawer_open}`;
    results.scrollY_match = (scrollY_before === scrollY_drawer_open) ? '相同' : '不同';
    
    // 步骤6: 尝试滚动背景页面
    console.log('步骤6: 尝试滚动背景页面150px');
    await page.evaluate(() => window.scrollBy(0, 150));
    await page.waitForTimeout(500);
    const scrollY_after_scroll = await page.evaluate(() => window.scrollY);
    console.log(`尝试滚动后 scrollY = ${scrollY_after_scroll}`);
    const canScroll = (scrollY_after_scroll !== scrollY_drawer_open);
    results.background_scrollable = canScroll ? '是' : '否';
    results.step6 = `完成 - 背景页面${canScroll ? '可以' : '不可以'}滚动`;
    
    // 步骤7: 关闭抽屉
    console.log('步骤7: 点击遮罩层关闭抽屉');
    await page.click('.drawer-overlay');
    await page.waitForTimeout(500);
    results.step7 = '成功 - 已关闭抽屉';
    
    // 步骤8: 检查关闭后的 scrollY
    console.log('步骤8: 检查抽屉关闭后的 scrollY');
    const scrollY_after_close = await page.evaluate(() => window.scrollY);
    console.log(`scrollY_after_close = ${scrollY_after_close}`);
    results.scrollY_after_close = scrollY_after_close;
    results.step8 = `成功 - scrollY_after_close = ${scrollY_after_close}`;
    results.scroll_restored = (Math.abs(scrollY_after_close - scrollY_before) < 5) ? '是' : '否';
    
    // 步骤9: 检查控制台错误
    console.log('步骤9: 检查控制台错误');
    const consoleErrors = await page.evaluate(() => {
      return window.consoleErrors || [];
    });
    results.console_errors = consoleErrors.length > 0 ? consoleErrors : '无错误';
    results.step9 = '成功 - 已检查控制台';
    
    // 输出结果
    console.log('\n===== 测试结果 =====');
    console.log(JSON.stringify(results, null, 2));
    
  } catch (error) {
    console.error('测试失败:', error);
    results.error = error.message;
  }
  
  // 等待5秒后关闭浏览器
  await page.waitForTimeout(5000);
  await browser.close();
})();
