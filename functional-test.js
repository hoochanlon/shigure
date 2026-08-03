const puppeteer = require('puppeteer');

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runFunctionalTests() {
  const results = {
    pageLoad: { status: 'pending', errors: [] },
    pomodoro: { status: 'pending', errors: [] },
    stopwatch: { status: 'pending', errors: [] },
    viewSwitch: { status: 'pending', errors: [] },
    wallpaper: { status: 'pending', errors: [] },
    zenMode: { status: 'pending', errors: [] },
    settings: { status: 'pending', errors: [] }
  };

  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    const consoleErrors = [];

    // 捕获控制台错误
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      consoleErrors.push(`Page Error: ${error.message}`);
    });

    // 1. 打开页面，检查控制台错误
    console.log('测试 1: 打开页面...');
    await page.goto('http://localhost:8000', { waitUntil: 'networkidle2', timeout: 10000 });
    await wait(3000);
    
    // 诊断：输出页面上的所有按钮 ID
    const buttonIds = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button[id], a[id]')).map(el => el.id);
    });
    console.log('页面上的所有按钮/链接 ID:', buttonIds);
    
    results.pageLoad.status = consoleErrors.length === 0 ? 'passed' : 'failed';
    results.pageLoad.errors = [...consoleErrors];
    console.log(`✓ 页面加载: ${results.pageLoad.status}, 错误数: ${consoleErrors.length}`);

    // 2. 测试番茄钟
    console.log('\n测试 2: 番茄钟功能...');
    try {
      // 确保在番茄钟视图
      await page.click('#tab-pomodoro');
      await wait(500);
      
      const getTime = () => page.evaluate(() => {
        const text = document.body.textContent;
        const match = text.match(/\b(\d{2}:\d{2})\b/);
        return match ? match[1] : '';
      });
      
      const initialTime = await getTime();
      console.log(`  初始时间: ${initialTime}`);
      
      if (!initialTime) {
        throw new Error('未找到时间显示');
      }
      
      // 点击开始工作
      await page.click('#start-work');
      await wait(3000);
      const timeAfterStart = await getTime();
      console.log(`  开始后时间: ${timeAfterStart}`);
      
      // 点击暂停
      await page.click('#pause-resume');
      await wait(1000);
      const timeAfterPause = await getTime();
      console.log(`  暂停后时间: ${timeAfterPause}`);
      await wait(2000);
      const timeStillPaused = await getTime();
      console.log(`  暂停后等待2秒: ${timeStillPaused}`);
      
      const pauseWorked = timeAfterPause === timeStillPaused;
      
      // 点击继续
      await page.click('#pause-resume');
      await wait(3000);
      const timeAfterResume = await getTime();
      console.log(`  恢复后时间: ${timeAfterResume}`);
      
      const timerWorked = initialTime !== timeAfterStart && pauseWorked && timeAfterResume !== timeStillPaused;
      results.pomodoro.status = timerWorked ? 'passed' : 'failed';
      if (!timerWorked) {
        results.pomodoro.errors.push(`计时逻辑异常: 开始${initialTime !== timeAfterStart}, 暂停${pauseWorked}, 恢复${timeAfterResume !== timeStillPaused}`);
      }
      console.log(`✓ 番茄钟测试: ${results.pomodoro.status}`);
    } catch (error) {
      results.pomodoro.status = 'failed';
      results.pomodoro.errors.push(error.message);
      console.log(`✗ 番茄钟测试失败: ${error.message}`);
    }

    // 3. 测试秒表
    console.log('\n测试 3: 秒表功能...');
    try {
      // 切换到秒表视图
      await page.click('#tab-stopwatch');
      await wait(1000);
      
      const getStopwatchTime = () => page.evaluate(() => {
        const text = document.body.textContent;
        const match = text.match(/\b(\d{2}:\d{2}\.\d{2})\b/);
        return match ? match[1] : '';
      });
      
      const initialStopwatch = await getStopwatchTime();
      console.log(`  初始秒表: ${initialStopwatch}`);
      
      // 开始秒表
      await page.click('#stopwatch-start');
      await wait(2000);
      const stopwatchRunning = await getStopwatchTime();
      console.log(`  运行中秒表: ${stopwatchRunning}`);
      
      // 停止秒表
      await page.click('#stopwatch-stop');
      await wait(1000);
      const stopwatchStopped = await getStopwatchTime();
      console.log(`  停止后秒表: ${stopwatchStopped}`);
      await wait(2000);
      const stopwatchStillStopped = await getStopwatchTime();
      console.log(`  停止后等待2秒: ${stopwatchStillStopped}`);
      
      const stopwatchWorked = initialStopwatch !== stopwatchRunning && stopwatchStopped === stopwatchStillStopped;
      results.stopwatch.status = stopwatchWorked ? 'passed' : 'failed';
      if (!stopwatchWorked) {
        results.stopwatch.errors.push(`秒表逻辑异常: 启动${initialStopwatch !== stopwatchRunning}, 停止${stopwatchStopped === stopwatchStillStopped}`);
      }
      console.log(`✓ 秒表测试: ${results.stopwatch.status}`);
    } catch (error) {
      results.stopwatch.status = 'failed';
      results.stopwatch.errors.push(error.message);
      console.log(`✗ 秒表测试失败: ${error.message}`);
    }

    // 4. 测试视图切换
    console.log('\n测试 4: 视图切换...');
    try {
      await page.click('#tab-pomodoro');
      await wait(500);
      await page.click('#tab-stopwatch');
      await wait(500);
      await page.click('#tab-pomodoro');
      await wait(500);
      
      results.viewSwitch.status = 'passed';
      console.log(`✓ 视图切换测试: passed`);
    } catch (error) {
      results.viewSwitch.status = 'failed';
      results.viewSwitch.errors.push(error.message);
      console.log(`✗ 视图切换失败: ${error.message}`);
    }

    // 5. 测试壁纸选择
    console.log('\n测试 5: 壁纸选择...');
    try {
      const errorsBefore = consoleErrors.length;
      
      // 点击不同壁纸选项
      await page.click('#wallpaper-dark');
      await wait(1000);
      await page.click('#wallpaper-rain');
      await wait(1000);
      await page.click('#wallpaper-light');
      await wait(500);
      
      const errorsAfter = consoleErrors.length;
      results.wallpaper.status = errorsBefore === errorsAfter ? 'passed' : 'failed';
      if (errorsBefore !== errorsAfter) {
        results.wallpaper.errors = consoleErrors.slice(errorsBefore);
      }
      console.log(`✓ 壁纸测试: ${results.wallpaper.status}`);
    } catch (error) {
      results.wallpaper.status = 'failed';
      results.wallpaper.errors.push(error.message);
      console.log(`✗ 壁纸测试失败: ${error.message}`);
    }

    // 6. 测试 Zen 模式
    console.log('\n测试 6: Zen 模式...');
    try {
      const errorsBefore = consoleErrors.length;
      
      // 打开设置面板
      await page.click('#zen-settings-toggle');
      await wait(1000);
      
      // 查找并点击 Zen 模式的 label（这会触发 checkbox）
      await page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('label'));
        const zenLabel = labels.find(l => l.textContent.includes('禅模式') || l.getAttribute('for') === 'switch-zen');
        if (zenLabel) {
          zenLabel.click();
        }
      });
      await wait(1000);
      
      // 再次切换
      await page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('label'));
        const zenLabel = labels.find(l => l.textContent.includes('禅模式') || l.getAttribute('for') === 'switch-zen');
        if (zenLabel) {
          zenLabel.click();
        }
      });
      await wait(1000);
      
      // 关闭设置面板
      await page.click('#zen-settings-toggle');
      await wait(500);
      
      const errorsAfter = consoleErrors.length;
      results.zenMode.status = errorsBefore === errorsAfter ? 'passed' : 'failed';
      if (errorsBefore !== errorsAfter) {
        results.zenMode.errors = consoleErrors.slice(errorsBefore);
      }
      console.log(`✓ Zen 模式测试: ${results.zenMode.status}`);
    } catch (error) {
      results.zenMode.status = 'failed';
      results.zenMode.errors.push(error.message);
      console.log(`✗ Zen 模式测试失败: ${error.message}`);
    }

    // 7. 测试设置
    console.log('\n测试 7: 设置面板...');
    try {
      const errorsBefore = consoleErrors.length;
      
      // 打开设置（如果未打开）
      const settingsPanel = await page.evaluate(() => {
        const panel = document.querySelector('#settings-panel');
        return panel ? !panel.hasAttribute('hidden') : false;
      });
      
      if (!settingsPanel) {
        await page.click('#zen-settings-toggle');
        await wait(1000);
      }
      
      // 修改番茄钟时长输入框
      await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input[type="number"]'));
        if (inputs.length > 0) {
          inputs[0].value = '30';
          inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      await wait(1000);
      
      // 关闭设置
      await page.click('#zen-settings-toggle');
      await wait(1000);
      
      const errorsAfter = consoleErrors.length;
      results.settings.status = errorsBefore === errorsAfter ? 'passed' : 'failed';
      if (errorsBefore !== errorsAfter) {
        results.settings.errors = consoleErrors.slice(errorsBefore);
      }
      console.log(`✓ 设置测试: ${results.settings.status}`);
    } catch (error) {
      results.settings.status = 'failed';
      results.settings.errors.push(error.message);
      console.log(`✗ 设置测试失败: ${error.message}`);
    }

  } catch (error) {
    console.error('测试执行失败:', error);
  } finally {
    await browser.close();
  }

  return results;
}

// 运行测试并输出结果
runFunctionalTests().then(results => {
  console.log('\n========== 测试结果汇总 ==========');
  Object.entries(results).forEach(([test, result]) => {
    const icon = result.status === 'passed' ? '✓' : result.status === 'failed' ? '✗' : '○';
    console.log(`${icon} ${test}: ${result.status}`);
    if (result.errors.length > 0) {
      result.errors.forEach(err => console.log(`  - ${err}`));
    }
  });
  
  const allPassed = Object.values(results).every(r => r.status === 'passed' || r.status === 'skipped');
  console.log(`\n总体状态: ${allPassed ? '通过' : '存在问题'}`);
  process.exit(allPassed ? 0 : 1);
}).catch(error => {
  console.error('测试脚本执行失败:', error);
  process.exit(1);
});
