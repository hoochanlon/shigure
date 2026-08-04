const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    console.log('1. 打开 http://localhost:8765');
    await page.goto('http://localhost:8765', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    console.log('2. 查找并点击待办页面入口');
    // 尝试多种可能的选择器
    const todoSelectors = [
      'text=待办',
      'text=简单Do',
      'a:has-text("待办")',
      'a:has-text("简单Do")',
      '[href*="simple-do"]',
      '[href*="todo"]'
    ];
    
    let clicked = false;
    for (const selector of todoSelectors) {
      try {
        const element = await page.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          await element.click();
          clicked = true;
          console.log(`  ✓ 点击了: ${selector}`);
          break;
        }
      } catch (e) {
        // 继续尝试下一个选择器
      }
    }
    
    if (!clicked) {
      console.log('  ⚠ 未找到待办入口，尝试直接访问');
      await page.goto('http://localhost:8765/simple-do.html', { waitUntil: 'networkidle' });
    }
    
    await page.waitForTimeout(1500);

    console.log('3. 切换到看板视图');
    
    // 先检查当前页面的按钮和状态
    const beforeSwitch = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return {
        allButtons: buttons.map(b => ({
          text: b.textContent.trim(),
          class: b.className,
          dataView: b.dataset.view
        })),
        bodyClass: document.body.className
      };
    });
    console.log('切换前状态:', JSON.stringify(beforeSwitch, null, 2));
    
    const kanbanSelectors = [
      'button[data-view="kanban"]',
      'text=看板',
      'button:has-text("看板")',
      '[data-view="kanban"]',
      '.view-toggle:has-text("看板")'
    ];
    
    let switched = false;
    for (const selector of kanbanSelectors) {
      try {
        const element = await page.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          await element.click();
          console.log(`  ✓ 切换到看板视图: ${selector}`);
          switched = true;
          break;
        }
      } catch (e) {
        // 继续尝试
      }
    }
    
    if (!switched) {
      console.log('  ⚠ 未能切换到看板视图');
    }
    
    await page.waitForTimeout(1500);
    
    // 检查切换后的状态
    const afterSwitch = await page.evaluate(() => {
      return {
        bodyClass: document.body.className,
        mainHTML: document.querySelector('main') ? document.querySelector('main').innerHTML.substring(0, 800) : null
      };
    });
    console.log('切换后状态:', JSON.stringify(afterSwitch, null, 2));

    console.log('4. 清除 localStorage 并刷新');
    await page.evaluate(() => {
      localStorage.removeItem('shigure.simple-do.state');
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    console.log('5. 重新切换到看板视图');
    // 刷新后需要再次点击看板按钮
    const kanbanButton = await page.locator('button[data-view="kanban"]').first();
    await kanbanButton.click();
    await page.waitForTimeout(1500);

    console.log('6. 截图空看板');
    await page.screenshot({ 
      path: '/Users/chanlonhoo/Documents/GitHub/shigure/kanban-empty.png',
      fullPage: false 
    });
    console.log('  ✓ 截图已保存: kanban-empty.png');

    console.log('\n7. 检查 DOM 结构和 CSS 属性');
    
    // 等待看板视图渲染（根据代码，看板列应该会动态创建）
    await page.waitForTimeout(1000);
    
    // 先获取整个看板区域的结构
    const pageStructure = await page.evaluate(() => {
      // 查找 simple-do 容器
      const simpleDoContainer = document.querySelector('.simple-do-container');
      const viewContainer = document.querySelector('.simple-do-view');
      
      if (viewContainer) {
        return {
          found: true,
          containerTag: viewContainer.tagName,
          containerClass: viewContainer.className,
          containerId: viewContainer.id,
          innerHTML: viewContainer.innerHTML.substring(0, 2000),
          childrenCount: viewContainer.children.length,
          childrenClasses: Array.from(viewContainer.children).map(c => ({
            tag: c.tagName,
            class: c.className,
            id: c.id,
            childCount: c.children.length
          }))
        };
      }
      
      return {
        found: false,
        bodyClasses: document.body.className,
        simpleDoExists: !!simpleDoContainer,
        allKanbanClasses: Array.from(document.querySelectorAll('[class*="kanban"]')).map(el => ({
          tag: el.tagName,
          class: el.className
        }))
      };
    });
    
    console.log('页面结构:', JSON.stringify(pageStructure, null, 2));
    
    // 查找看板列
    const columnSelectors = [
      '.kanban-column',
      '.kanban-board > .kanban-column',
      '[class*="kanban-column"]'
    ];
    
    let columnSelector = null;
    for (const selector of columnSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        columnSelector = selector;
        console.log(`  ✓ 找到看板列选择器: ${selector} (${count} 个)`);
        break;
      }
    }
    
    if (!columnSelector) {
      console.log('  ⚠ 未找到看板列');
      await browser.close();
      return;
    }

    // 获取第一个看板列的详细信息
    const domInfo = await page.evaluate((selector) => {
      const column = document.querySelector(selector);
      if (!column) return null;

      function getElementInfo(el, depth = 0, maxDepth = 8) {
        if (!el || depth > maxDepth) return null;
        
        const computed = window.getComputedStyle(el);
        const info = {
          depth,
          tagName: el.tagName.toLowerCase(),
          className: el.className,
          id: el.id,
          computedHeight: computed.height,
          computedMinHeight: computed.minHeight,
          computedMaxHeight: computed.maxHeight,
          overflow: computed.overflow,
          overflowY: computed.overflowY,
          overflowX: computed.overflowX,
          borderRadius: computed.borderRadius,
          borderBottomLeftRadius: computed.borderBottomLeftRadius,
          borderBottomRightRadius: computed.borderBottomRightRadius,
          display: computed.display,
          flexDirection: computed.flexDirection,
          flexGrow: computed.flexGrow,
          flexShrink: computed.flexShrink,
          position: computed.position,
          padding: computed.padding,
          margin: computed.margin,
          boxSizing: computed.boxSizing,
          children: []
        };

        // 递归获取子元素信息
        for (let child of el.children) {
          info.children.push(getElementInfo(child, depth + 1, maxDepth));
        }

        return info;
      }

      return getElementInfo(column);
    }, columnSelector);

    console.log('\n=== DOM 结构和 CSS 详情 ===\n');
    console.log(JSON.stringify(domInfo, null, 2));

    // 获取所有看板列的简要信息
    const allColumns = await page.evaluate((selector) => {
      const columns = document.querySelectorAll(selector);
      return Array.from(columns).map((col, index) => {
        const computed = window.getComputedStyle(col);
        const header = col.querySelector('.kanban-column-header');
        const body = col.querySelector('.kanban-column-body');
        return {
          index,
          className: col.className,
          height: computed.height,
          overflow: computed.overflow,
          overflowY: computed.overflowY,
          borderRadius: computed.borderRadius,
          childCount: col.children.length,
          header: header ? {
            className: header.className,
            height: window.getComputedStyle(header).height,
            overflow: window.getComputedStyle(header).overflow
          } : null,
          body: body ? {
            className: body.className,
            height: window.getComputedStyle(body).height,
            overflow: window.getComputedStyle(body).overflow,
            overflowY: window.getComputedStyle(body).overflowY,
            borderRadius: window.getComputedStyle(body).borderRadius
          } : null
        };
      });
    }, columnSelector);

    console.log('\n=== 所有看板列概览 ===\n');
    console.log(JSON.stringify(allColumns, null, 2));

    // 检查是否有圆角被裁切的问题
    const clipIssue = await page.evaluate((selector) => {
      const column = document.querySelector(selector);
      if (!column) return null;

      const computed = window.getComputedStyle(column);
      const hasRoundedCorners = computed.borderRadius !== '0px' && computed.borderRadius !== '';
      const hasOverflowHidden = computed.overflow === 'hidden' || computed.overflowY === 'hidden';

      // 检查子元素
      const body = column.querySelector('.kanban-column-body');
      let bodyInfo = null;
      if (body) {
        const bodyComputed = window.getComputedStyle(body);
        bodyInfo = {
          hasRoundedCorners: bodyComputed.borderRadius !== '0px' && bodyComputed.borderRadius !== '',
          borderRadius: bodyComputed.borderRadius,
          overflow: bodyComputed.overflow,
          overflowY: bodyComputed.overflowY,
          height: bodyComputed.height
        };
      }

      // 检查父元素
      let parent = column.parentElement;
      let parentClipping = false;
      if (parent) {
        const parentComputed = window.getComputedStyle(parent);
        parentClipping = parentComputed.overflow === 'hidden' || parentComputed.overflowY === 'hidden';
      }

      return {
        column: {
          hasRoundedCorners,
          borderRadius: computed.borderRadius,
          hasOverflowHidden,
          overflow: computed.overflow,
          overflowY: computed.overflowY
        },
        body: bodyInfo,
        parent: {
          clipping: parentClipping,
          overflow: parent ? window.getComputedStyle(parent).overflow : null,
          overflowY: parent ? window.getComputedStyle(parent).overflowY : null
        }
      };
    }, columnSelector);

    console.log('\n=== 圆角裁切分析 ===\n');
    console.log(JSON.stringify(clipIssue, null, 2));

    await page.waitForTimeout(5000); // 保持浏览器打开5秒以便查看

  } catch (error) {
    console.error('错误:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
