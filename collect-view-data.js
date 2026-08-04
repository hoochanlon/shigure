const puppeteer = require('puppeteer');

const selectors = [
  '.app-header',
  '.workspace',
  '.timer-stage',
  '#simple-do-screen',
  '#simple-do-view',
  '.simple-do-intro'
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function collectViewData(page, viewName) {
  console.log(`\n正在收集 ${viewName} 视图数据...`);
  
  // 等待页面稳定
  await sleep(500);
  
  // 获取 body className
  const bodyClassName = await page.evaluate(() => {
    return document.body.className;
  });
  
  const data = {
    viewName,
    bodyClassName,
    elements: {}
  };
  
  // 对每个选择器收集数据
  for (const selector of selectors) {
    const elementData = await page.evaluate((sel) => {
      const element = document.querySelector(sel);
      if (!element) {
        return null;
      }
      
      const rect = element.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(element);
      
      return {
        rect: {
          bottom: sel === '.app-header' ? rect.bottom : undefined,
          top: sel !== '.app-header' ? rect.top : undefined
        },
        computedStyles: {
          marginTop: computedStyle.marginTop,
          paddingTop: computedStyle.paddingTop,
          display: computedStyle.display,
          position: computedStyle.position
        }
      };
    }, selector);
    
    if (elementData) {
      data.elements[selector] = elementData;
    } else {
      data.elements[selector] = '不存在';
    }
  }
  
  return data;
}

async function main() {
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: { width: 1280, height: 800 }
  });
  
  const page = await browser.newPage();
  
  try {
    // 访问页面
    await page.goto('http://localhost:8848', { waitUntil: 'networkidle2' });
    await sleep(1000);
    
    // 点击进入待办事项页面
    console.log('\n进入待办事项页面');
    await page.click('#simple-do-rail-toggle');
    await sleep(1000);
    
    const results = [];
    
    // 收集"四象限"视图数据
    console.log('\n切换到"四象限"视图');
    await page.click('[data-action="set-view"][data-view="quadrants"]');
    await sleep(800);
    results.push(await collectViewData(page, '四象限'));
    
    // 收集"看板"视图数据
    console.log('\n切换到"看板"视图');
    await page.click('[data-action="set-view"][data-view="kanban"]');
    await sleep(800);
    results.push(await collectViewData(page, '看板'));
    
    // 收集"全部事项"视图数据
    console.log('\n切换到"全部事项"视图');
    await page.click('[data-action="set-view"][data-view="all"]');
    await sleep(800);
    results.push(await collectViewData(page, '全部事项'));
    
    // 输出结果
    console.log('\n\n========== 完整结果 ==========\n');
    console.log(JSON.stringify(results, null, 2));
    
  } catch (error) {
    console.error('错误:', error);
  } finally {
    await browser.close();
  }
}

main();
