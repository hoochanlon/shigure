const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--window-size=1280,900']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  
  const results = {
    steps: [],
    scrollY_before: null,
    scrollY_drawer_open: null,
    scrollY_after_close: null,
    backgroundScrollable: null,
    consoleErrors: [],
    abnormalBehaviors: []
  };
  
  // 监听控制台
  page.on('console', msg => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      results.consoleErrors.push(`[${type}] ${msg.text()}`);
    }
  });
  
  try {
    // 步骤1: 打开页面
    console.log('步骤1: 打开 http://localhost:8000');
    await page.goto('http://localhost:8000', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1000));
    results.steps.push({ step: 1, status: '成功', desc: '页面加载完成' });
    
    // 打开待办事项页面
    console.log('打开待办事项页面');
    await page.click('#simple-do-rail-toggle');
    await new Promise(r => setTimeout(r, 1000));
    
    // 步骤2: 检查待办事项数量，添加足够的待办事项确保页面可滚动
    console.log('步骤2: 添加待办事项确保页面可滚动');
    const needAdd = 15; // 添加15个确保页面足够高
    console.log(`添加 ${needAdd} 个待办事项`);
    
    for (let i = 0; i < needAdd; i++) {
      const input = await page.$('.simple-do-quadrant.q1 .simple-do-add input[name="title"]');
      if (!input) {
        throw new Error('未找到输入框');
      }
      await input.type(`测试待办事项 ${i + 1}`);
      const submitBtn = await page.$('.simple-do-quadrant.q1 .simple-do-add button[type="submit"]');
      await submitBtn.click();
      await new Promise(r => setTimeout(r, 150));
    }
    results.steps.push({ step: 2, status: '成功', desc: `添加了${needAdd}个待办事项` });
    
    // 等待页面布局稳定
    await new Promise(r => setTimeout(r, 800));
    
    // 检查页面是否可滚动
    const pageHeight = await page.evaluate(() => {
      return {
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight
      };
    });
    console.log(`页面高度: scrollHeight=${pageHeight.scrollHeight}, clientHeight=${pageHeight.clientHeight}`);
    
    if (pageHeight.scrollHeight <= pageHeight.clientHeight) {
      console.log('警告: 页面高度不足以产生滚动条');
      results.abnormalBehaviors.push('页面高度不足以产生滚动条');
    }
    
    // 步骤3: 滚动到400px位置
    console.log('步骤3: 滚动到400px位置');
    await page.evaluate(() => window.scrollTo(0, 400));
    await new Promise(r => setTimeout(r, 500));
    
    const scrollY_before = await page.evaluate(() => window.scrollY);
    results.scrollY_before = scrollY_before;
    console.log(`scrollY_before: ${scrollY_before}`);
    results.steps.push({ step: 3, status: '成功', desc: `滚动到${scrollY_before}px` });
    
    // 步骤4: 点击"完成记录"按钮打开抽屉
    console.log('步骤4: 点击"完成记录"按钮');
    await page.waitForSelector('#simple-do-history-toggle', { timeout: 5000 });
    await page.click('#simple-do-history-toggle');
    await new Promise(r => setTimeout(r, 600));
    results.steps.push({ step: 4, status: '成功', desc: '点击完成记录按钮' });
    
    // 步骤5: 检查抽屉打开后的scrollY
    console.log('步骤5: 检查抽屉打开后的scrollY');
    const scrollY_drawer_open = await page.evaluate(() => window.scrollY);
    results.scrollY_drawer_open = scrollY_drawer_open;
    console.log(`scrollY_drawer_open: ${scrollY_drawer_open}`);
    
    const scrollMatch = scrollY_before === scrollY_drawer_open;
    results.steps.push({ 
      step: 5, 
      status: scrollMatch ? '成功' : '失败', 
      desc: `抽屉打开后scrollY=${scrollY_drawer_open}, ${scrollMatch ? '与' : '不与'}打开前相同` 
    });
    
    if (!scrollMatch) {
      results.abnormalBehaviors.push(`抽屉打开改变了滚动位置: ${scrollY_before} -> ${scrollY_drawer_open}`);
    }
    
    // 步骤6: 尝试滚动背景页面
    console.log('步骤6: 尝试滚动背景页面');
    const scrollBefore = await page.evaluate(() => window.scrollY);
    
    // 尝试通过scrollBy滚动
    await page.evaluate(() => {
      window.scrollBy(0, 150);
    });
    await new Promise(r => setTimeout(r, 300));
    
    const scrollAfterAttempt = await page.evaluate(() => window.scrollY);
    const didScroll = scrollAfterAttempt !== scrollBefore;
    results.backgroundScrollable = didScroll ? '是' : '否';
    
    console.log(`尝试滚动前: ${scrollBefore}, 尝试滚动后: ${scrollAfterAttempt}`);
    results.steps.push({ 
      step: 6, 
      status: didScroll ? '失败' : '成功', 
      desc: `背景页面${didScroll ? '可以' : '无法'}滚动 (${scrollBefore} -> ${scrollAfterAttempt})` 
    });
    
    if (didScroll) {
      results.abnormalBehaviors.push(`抽屉打开时背景页面仍可滚动: ${scrollBefore} -> ${scrollAfterAttempt}`);
    }
    
    // 步骤7: 点击遮罩层关闭抽屉
    console.log('步骤7: 点击遮罩层关闭抽屉');
    await page.click('#simple-do-history-backdrop');
    await new Promise(r => setTimeout(r, 600));
    results.steps.push({ step: 7, status: '成功', desc: '点击遮罩层关闭抽屉' });
    
    // 步骤8: 检查关闭后的scrollY
    console.log('步骤8: 检查关闭后的scrollY');
    const scrollY_after_close = await page.evaluate(() => window.scrollY);
    results.scrollY_after_close = scrollY_after_close;
    console.log(`scrollY_after_close: ${scrollY_after_close}`);
    
    const scrollRestored = scrollY_after_close === scrollY_before;
    results.steps.push({ 
      step: 8, 
      status: scrollRestored ? '成功' : '失败', 
      desc: `抽屉关闭后scrollY=${scrollY_after_close}, ${scrollRestored ? '恢复到' : '未恢复到'}初始位置` 
    });
    
    if (!scrollRestored) {
      results.abnormalBehaviors.push(`抽屉关闭后未恢复滚动位置: 期望${scrollY_before}, 实际${scrollY_after_close}`);
    }
    
    // 步骤9: 完成
    await new Promise(r => setTimeout(r, 1000));
    results.steps.push({ step: 9, status: '成功', desc: '测试完成' });
    
  } catch (error) {
    results.steps.push({ step: 'error', status: '异常', desc: error.message });
    console.error('测试异常:', error);
  }
  
  // 输出结果
  console.log('\n========== 测试结果 ==========');
  console.log('\n各步骤执行结果:');
  results.steps.forEach(s => {
    console.log(`  步骤${s.step}: ${s.status} - ${s.desc}`);
  });
  
  console.log('\n关键数据:');
  console.log(`  scrollY_before: ${results.scrollY_before}`);
  console.log(`  scrollY_drawer_open: ${results.scrollY_drawer_open}`);
  console.log(`  scrollY_after_close: ${results.scrollY_after_close}`);
  console.log(`  背景页面是否可滚动: ${results.backgroundScrollable}`);
  
  if (results.consoleErrors.length > 0) {
    console.log('\n控制台错误/警告:');
    results.consoleErrors.forEach(err => console.log(`  ${err}`));
  } else {
    console.log('\n控制台错误/警告: 无');
  }
  
  if (results.abnormalBehaviors.length > 0) {
    console.log('\n异常行为:');
    results.abnormalBehaviors.forEach(ab => console.log(`  - ${ab}`));
  } else {
    console.log('\n异常行为: 无');
  }
  
  console.log('\n==============================\n');
  
  await browser.close();
})();
