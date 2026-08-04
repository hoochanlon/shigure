const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--window-size=1280,800']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  const results = {
    quadrants: null,
    kanban: null,
    allItems: null
  };
  
  const extractData = () => {
    return page.evaluate(() => {
      const selectors = ['.timer-stage', '#simple-do-screen', '#simple-do-view', '.simple-do-intro'];
      const result = {
        bodyClassName: document.body.className,
        elements: {}
      };

      selectors.forEach(sel => {
        const el = document.querySelector(sel);
        if (el) {
          const rect = el.getBoundingClientRect();
          const computed = window.getComputedStyle(el);
          result.elements[sel] = {
            top: rect.top,
            marginTop: computed.marginTop,
            marginBottom: computed.marginBottom,
            paddingTop: computed.paddingTop,
            paddingBottom: computed.paddingBottom,
            display: computed.display,
            height: computed.height
          };
        } else {
          result.elements[sel] = null;
        }
      });

      return result;
    });
  };
  
  try {
    console.log('步骤1: 访问 http://localhost:8848');
    await page.goto('http://localhost:8848', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1000));
    
    console.log('步骤2: 进入待办页面');
    // 查找进入待办页面的按钮
    let todoButton = await page.$('#simple-do-rail-toggle');
    if (!todoButton) {
      todoButton = await page.$('#simple-do-toggle');
    }
    if (todoButton) {
      await todoButton.click();
      await new Promise(r => setTimeout(r, 1500));
    } else {
      console.log('未找到待办按钮');
    }
    
    console.log('步骤3: 切换到四象限视图');
    const quadrantsTab = await page.$('[data-action="set-view"][data-view="quadrants"]');
    if (quadrantsTab) {
      await quadrantsTab.click();
      await new Promise(r => setTimeout(r, 500));
    }
    console.log('提取四象限视图数据');
    results.quadrants = await extractData();
    
    console.log('步骤4: 切换到看板视图');
    const kanbanTab = await page.$('[data-action="set-view"][data-view="kanban"]');
    if (kanbanTab) {
      await kanbanTab.click();
      await new Promise(r => setTimeout(r, 500));
    }
    console.log('提取看板视图数据');
    results.kanban = await extractData();
    
    console.log('步骤5: 切换到全部事项视图');
    const allTab = await page.$('[data-action="set-view"][data-view="all"]');
    if (allTab) {
      await allTab.click();
      await new Promise(r => setTimeout(r, 500));
    }
    console.log('提取全部事项视图数据');
    results.allItems = await extractData();
    
  } catch (error) {
    console.error('执行异常:', error);
  }
  
  console.log('\n========== 提取结果 ==========\n');
  console.log('1. 四象限视图:');
  console.log(JSON.stringify(results.quadrants, null, 2));
  console.log('\n2. 看板视图:');
  console.log(JSON.stringify(results.kanban, null, 2));
  console.log('\n3. 全部事项视图:');
  console.log(JSON.stringify(results.allItems, null, 2));
  console.log('\n==============================\n');
  
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
})();
