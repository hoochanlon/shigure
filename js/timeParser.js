/**
 * 智能解析时间输入，支持多种格式
 * @param {string} input - 用户输入的时间字符串
 * @returns {number|null} - 返回秒数，无效输入返回 null
 * 
 * 支持的格式：
 * - 纯数字: "120" → 120秒
 * - MM:SS: "05:30" → 330秒（5分30秒）
 * - HH:MM:SS: "01:30:00" → 5400秒（1小时30分）
 * - HH:MM:SS.ms: "01:30:00.50" → 5400.5秒（1小时30分0.5秒）
 */
export const parseTimeInput = (input) => {
  if (!input || typeof input !== 'string') return null;
  
  const trimmed = input.trim();
  if (!trimmed) return null;
  
  // 纯数字：视为秒数
  if (/^\d+$/.test(trimmed)) {
    const seconds = parseInt(trimmed, 10);
    return isNaN(seconds) || seconds < 0 ? null : seconds;
  }
  
  // HH:MM:SS.ms 或 HH:MM:SS
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    
    // MM:SS 格式
    if (parts.length === 2) {
      const [minutesStr, secondsWithMs] = parts;
      const minutes = parseInt(minutesStr, 10);
      
      // 处理秒数部分（可能包含小数点）
      const secondsParts = secondsWithMs.split('.');
      const seconds = parseInt(secondsParts[0], 10);
      const ms = secondsParts[1] ? parseInt(secondsParts[1].padEnd(2, '0').slice(0, 2), 10) / 100 : 0;
      
      if (isNaN(minutes) || isNaN(seconds) || minutes < 0 || seconds < 0 || seconds >= 60) {
        return null;
      }
      
      return minutes * 60 + seconds + ms;
    }
    
    // HH:MM:SS 或 HH:MM:SS.ms 格式
    if (parts.length === 3) {
      const [hoursStr, minutesStr, secondsWithMs] = parts;
      const hours = parseInt(hoursStr, 10);
      const minutes = parseInt(minutesStr, 10);
      
      // 处理秒数部分（可能包含小数点）
      const secondsParts = secondsWithMs.split('.');
      const seconds = parseInt(secondsParts[0], 10);
      const ms = secondsParts[1] ? parseInt(secondsParts[1].padEnd(2, '0').slice(0, 2), 10) / 100 : 0;
      
      if (isNaN(hours) || isNaN(minutes) || isNaN(seconds) || 
          hours < 0 || minutes < 0 || minutes >= 60 || seconds < 0 || seconds >= 60) {
        return null;
      }
      
      return hours * 3600 + minutes * 60 + seconds + ms;
    }
  }
  
  return null;
};
