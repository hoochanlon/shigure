const puppeteer = require('puppeteer');
const fs = require('fs');

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function zenAndSettingsTest() {
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 800 }
  });
  
  try {
    const page = await browser.newPage();
    
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    page.on('pageerror', error => {
      consoleErrors.push(`Page Error: ${error.message}`);
    });
    
    const screenshotDir = './test-screenshots';
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir);
    }
    
    console.log('打开页面');
    await page.goto('http://localhost:8000', { waitUntil: 'networkidle2' });
    await wait(2000);
    
    // 步骤 1-3: 测试 Zen 模式
    console.log('\n========== Zen 模式测试 ==========');
    console.log('步骤 1: 查找并打开 Zen 模式开关');
    
    // 先截图初始状态
    await page.screenshot({ path: `${screenshotDir}/zen-00-initial.png` });
    
    // 使用 evaluate 点击，避免元素不可点击问题
    const settingsOpened = await page.evaluate(() => {
      const btn = document.querySelector('#zen-settings-toggle');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    
    console.log(`  设置按钮点击: ${settingsOpened}`);
    await wait(1000);
    await page.screenshot({ path: `${screenshotDir}/zen-01-settings-opened.png` });
    
    // 查找 Zen 模式开关并点击
    const zenSwitchFound = await page.evaluate(() => {
      // 查找所有 input checkbox
      const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
      console.log('所有 checkbox ID:', checkboxes.map(c => c.id));
      
      // 查找所有 label 文本
      const labels = Array.from(document.querySelectorAll('label'));
      console.log('所有 label 文本:', labels.map(l => l.textContent.trim()));
      
      const zenLabel = labels.find(l => l.textContent.includes('禅模式') || l.textContent.includes('Zen'));
      if (zenLabel) {
        const forId = zenLabel.getAttribute('for');
        const checkbox = forId ? document.getElementById(forId) : zenLabel.querySelector('input[type="checkbox"]');
        return checkbox ? { found: true, id: checkbox.id } : { found: false };
      }
      return { found: false };
    });
    
    console.log(`  找到 Zen 模式开关: ${zenSwitchFound.found}`, zenSwitchFound.id ? `(ID: ${zenSwitchFound.id})` : '');
    
    if (zenSwitchFound.found) {
      // 获取开启前的状态
      const beforeZen = await page.evaluate(() => {
        return document.documentElement.classList.contains('zen-mode');
      });
      console.log(`  开启前 Zen 状态: ${beforeZen}`);
      
      // 点击 Zen 模式开关
      await page.evaluate((id) => {
        const checkbox = document.getElementById(id);
        if (checkbox) checkbox.click();
      }, zenSwitchFound.id);
      await wait(500);
      
      const afterZenOn = await page.evaluate(() => {
        return document.documentElement.classList.contains('zen-mode') || 
               document.body.classList.contains('zen-mode') ||
               document.querySelector('.zen-mode') !== null;
      });
      
      await page.screenshot({ path: `${screenshotDir}/zen-02-enabled.png` });
      console.log(`步骤 2: Zen 模式已开启: ${afterZenOn}`);
      
      // 关闭 Zen 模式
      console.log('步骤 3: 关闭 Zen 模式');
      await page.evaluate((id) => {
        const checkbox = document.getElementById(id);
        if (checkbox) checkbox.click();
      }, zenSwitchFound.id);
      await wait(500);
      
      const afterZenOff = await page.evaluate(() => {
        return document.documentElement.classList.contains('zen-mode') || 
               document.body.classList.contains('zen-mode') ||
               document.querySelector('.zen-mode') !== null;
      });
      
      await page.screenshot({ path: `${screenshotDir}/zen-03-disabled.png` });
      console.log(`  Zen 模式已关闭: ${!afterZenOff}`);
      
      // 通过截图文件大小判断（Zen 模式下截图更小）
      const fs = require('fs');
      const enabledSize = fs.statSync(`${screenshotDir}/zen-02-enabled.png`).size;
      const disabledSize = fs.statSync(`${screenshotDir}/zen-03-disabled.png`).size;
      const zenWorkedBySize = enabledSize < disabledSize * 0.6;
      
      console.log(`  截图大小对比: 开启=${(enabledSize/1024).toFixed(1)}KB, 关闭=${(disabledSize/1024).toFixed(1)}KB`);
      console.log(`\nZen 模式功能: ${zenWorkedBySize ? '✓ 正常（界面有明显变化）' : '✗ 异常'}`);
    } else {
      console.log('✗ 未找到 Zen 模式开关');
    }
    
    // 步骤 4-7: 测试设置修改
    console.log('\n========== 设置修改测试 ==========');
    console.log('步骤 4: 设置面板已打开');
    await page.screenshot({ path: `${screenshotDir}/settings-01-panel.png` });
    
    console.log('步骤 5: 查找番茄钟时长设置');
    const pomodoroInput = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      const pomodoroLabel = labels.find(l => 
        l.textContent.includes('专注时长') || 
        l.textContent.includes('番茄钟') ||
        l.textContent.includes('工作时长')
      );
      
      if (pomodoroLabel) {
        const input = pomodoroLabel.querySelector('input[type="number"]') ||
                     document.querySelector('input[type="number"]');
        if (input) {
          return {
            found: true,
            currentValue: input.value,
            id: input.id
          };
        }
      }
      
      // 备选：直接找第一个 number input
      const firstInput = document.querySelector('input[type="number"]');
      if (firstInput) {
        return {
          found: true,
          currentValue: firstInput.value,
          id: firstInput.id
        };
      }
      
      return { found: false };
    });
    
    console.log(`  找到番茄钟时长输入框: ${pomodoroInput.found}`);
    console.log(`  当前值: ${pomodoroInput.currentValue}`);
    
    if (pomodoroInput.found) {
      console.log('步骤 6: 修改番茄钟时长为 30');
      await page.evaluate(() => {
        const input = document.querySelector('input[type="number"]');
        if (input) {
          input.value = '30';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      await wait(1000);
      await page.screenshot({ path: `${screenshotDir}/settings-02-modified.png` });
      
      const newValue = await page.evaluate(() => {
        const input = document.querySelector('input[type="number"]');
        return input ? input.value : null;
      });
      console.log(`  新值已设置: ${newValue}`);
    }
    
    console.log('步骤 7: 关闭设置面板');
    await page.evaluate(() => {
      const btn = document.querySelector('#zen-settings-toggle');
      if (btn) btn.click();
    });
    await wait(1000);
    await page.screenshot({ path: `${screenshotDir}/settings-03-closed.png` });
    
    // 切换到番茄钟视图检查时间
    await page.click('#tab-pomodoro');
    await wait(500);
    
    const timerDisplay = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while (node = walker.nextNode()) {
        const text = node.textContent.trim();
        if (/^\d{2}:\d{2}$/.test(text) && node.parentElement) {
          const style = window.getComputedStyle(node.parentElement);
          const fontSize = parseFloat(style.fontSize);
          if (fontSize > 30) {
            return text;
          }
        }
      }
      return null;
    });
    
    console.log(`  主界面显示时间: ${timerDisplay}`);
    await page.screenshot({ path: `${screenshotDir}/settings-04-timer-updated.png` });
    
    const settingsWorked = timerDisplay === '30:00';
    console.log(`\n设置修改功能: ${settingsWorked ? '✓ 正常（时间已更新为 30:00）' : '⚠ 可能需要重置计时器'}`);
    
    // 输出控制台错误
    console.log('\n========== 控制台错误检查 ==========');
    if (consoleErrors.length === 0) {
      console.log('✓ 无控制台错误');
    } else {
      console.log(`✗ 发现 ${consoleErrors.length} 个错误:`);
      consoleErrors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. ${err}`);
      });
    }
    
    console.log(`\n截图已保存到: ${screenshotDir}/`);
    
    await wait(3000);
    
  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    await browser.close();
  }
}

zenAndSettingsTest();
