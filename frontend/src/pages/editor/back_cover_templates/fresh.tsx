import React from 'react';
import { BackCoverTemplateProps } from './index';

const Fresh: React.FC<BackCoverTemplateProps> = ({
  storybookTitle,
  logoUrl,
  editorMessage,
  backgroundColor,
  aspectRatio
}) => {
  // 1:1 正方形布局 - 紧凑垂直布局
  if (aspectRatio === '1:1') {
    return (
      <div className="w-full h-full flex items-center justify-center relative overflow-hidden" style={{ background: backgroundColor }}>
        {/* 背景装饰 */}
        <div className="absolute rounded-full bg-[rgba(77,208,225,0.1)]" style={{ width: '50%', height: '50%', top: '-15%', left: '-15%' }} />
        <div className="absolute rounded-full bg-[rgba(77,208,225,0.1)]" style={{ width: '40%', height: '40%', bottom: '-12%', right: '-12%' }} />

        <div className="relative z-10 flex flex-col items-center justify-center w-full h-full px-[6%] py-[4%] box-border">
          {/* Logo - 正方形适中 */}
          <div className="w-[26%] aspect-square bg-white rounded-full p-[3%] shadow-md flex items-center justify-center border-[3px] border-[#4dd0e1] flex-shrink-0">
            <img
              src={logoUrl}
              alt="Logo"
              className="w-full h-full rounded-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>

          {/* 标题 - 小字体，支持换行 */}
          <div className="mt-[3%] text-[#00838f] font-bold text-center leading-tight w-full" style={{ fontFamily: 'ZCOOL KuaiLe, cursive', fontSize: 'min(5vw, 20px)' }}>
            毛毛虫绘本
            <div className="text-[min(4vw, 16px)] font-normal px-2 break-words" style={{ fontSize: 'min(4vw, 15px)' }}>{storybookTitle}</div>
          </div>

          {/* 文案区 - 限制行数和字数 */}
          <div className="mt-[4%] bg-white/60 rounded-[12px] p-[4%] border-[2px] border-dashed border-[#4dd0e1] w-full" style={{ minHeight: '32%' }}>
            <p className="text-[#546e7a] font-bold mb-[2%] text-center" style={{ fontSize: 'min(3vw, 12px)' }}>【编者寄语】</p>
            <div
              className="w-full text-center leading-snug text-[#546e7a] break-words"
              style={{
                fontSize: 'min(2.5vw, 11px)',
                lineHeight: '1.5',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                wordBreak: 'break-word',
                maxWidth: '100%'
              }}
            >
              {editorMessage}
            </div>
          </div>

          {/* 底部信息 - 二维码 */}
          <div className="mt-[4%] flex justify-between items-end w-full flex-shrink-0">
            <div className="bg-white border border-gray-300 flex flex-col items-center justify-center p-[2%] flex-shrink-0" style={{ width: '22%', minWidth: '50px', aspectRatio: '1' }}>
              <div className="w-[80%] h-[80%] bg-gray-200 rounded flex items-center justify-center" style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 2px,#000 2px,#000 4px),repeating-linear-gradient(90deg,transparent,transparent 2px,#000 2px,#000 4px)', backgroundSize: '4px 4px' }} />
            </div>

            <div className="text-right text-[#78909c] leading-snug flex-1 ml-[3%]" style={{ fontSize: 'min(2.5vw, 11px)' }}>
              <p className="truncate">毛毛虫文化传播有限公司</p>
              <p>www.nanbende.com</p>
              <p className="mt-[1%]">上架建议：儿童绘本 / 启蒙</p>
            </div>
          </div>

          {/* 装饰脚印 */}
          <div className="absolute rounded-full bg-[#b2ebf2] opacity-50" style={{ width: '6%', height: '5%', bottom: '18%', left: '8%', transform: 'rotate(-20deg)', minWidth: '12px', minHeight: '10px' }} />
          <div className="absolute rounded-full bg-[#b2ebf2] opacity-50" style={{ width: '6%', height: '5%', bottom: '22%', left: '15%', transform: 'rotate(10deg)', minWidth: '12px', minHeight: '10px' }} />
          <div className="absolute rounded-full bg-[#b2ebf2] opacity-50" style={{ width: '6%', height: '5%', bottom: '19%', left: '22%', transform: 'rotate(-15deg)', minWidth: '12px', minHeight: '10px' }} />
        </div>
      </div>
    );
  }

  // 16:9 横向布局 - 左右分栏
  if (aspectRatio === '16:9') {
    return (
      <div className="w-full h-full flex items-center justify-center relative overflow-hidden" style={{ background: backgroundColor }}>
        {/* 背景装饰 */}
        <div className="absolute rounded-full bg-[rgba(77,208,225,0.1)]" style={{ width: '280px', height: '280px', top: '-70px', left: '-70px' }} />
        <div className="absolute rounded-full bg-[rgba(77,208,225,0.1)]" style={{ width: '200px', height: '200px', bottom: '-50px', right: '-50px' }} />

        <div className="relative z-10 flex items-stretch w-full h-full px-[8%] py-[4%] gap-[6%]">
          {/* 左侧：Logo + 标题 */}
          <div className="flex flex-col items-center justify-center flex-shrink-0" style={{ width: '22%' }}>
            <div className="w-full aspect-square bg-white rounded-full p-[4px] shadow-md flex items-center justify-center border-[3px] border-[#4dd0e1]">
              <img
                src={logoUrl}
                alt="Logo"
                className="w-full h-full rounded-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <div className="mt-[8px] text-[#00838f] font-bold text-center leading-tight w-full" style={{ fontFamily: 'ZCOOL KuaiLe, cursive', fontSize: 'min(3vw, 18px)' }}>
              毛毛虫绘本
              <div className="px-1 break-words" style={{ fontSize: 'min(2.5vw, 14px)' }}>{storybookTitle}</div>
            </div>
          </div>

          {/* 中间：文案区 - 限制行数和字数 */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="bg-white/60 rounded-[12px] px-[4%] py-[3%] border-[2px] border-dashed border-[#4dd0e1] h-[70%]">
              <div className="w-full h-full flex flex-col">
                <p className="text-[#546e7a] font-bold mb-[2%] text-center flex-shrink-0" style={{ fontSize: 'min(2vw, 14px)' }}>【编者寄语】</p>
                <div
                  className="w-full flex-1 text-center leading-relaxed text-[#546e7a] break-words"
                  style={{
                    fontSize: 'min(1.5vw, 12px)',
                    lineHeight: '1.6',
                    display: '-webkit-box',
                    WebkitLineClamp: 5,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    wordBreak: 'break-word',
                    maxWidth: '90%'
                  }}
                >
                  {editorMessage}
                </div>
              </div>
            </div>
          </div>

          {/* 右侧：二维码 */}
          <div className="flex flex-col justify-between flex-shrink-0" style={{ width: '23%' }}>
            <div className="bg-white border border-gray-300 flex items-center justify-center p-[2%]" style={{ aspectRatio: '1', minWidth: '70px' }}>
              <div className="w-[85%] h-[85%] bg-gray-200 rounded" style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 2px,#000 2px,#000 4px),repeating-linear-gradient(90deg,transparent,transparent 2px,#000 2px,#000 4px)', backgroundSize: '4px 4px' }} />
            </div>

            <div className="text-right text-[#78909c] leading-snug mt-[8px]" style={{ fontSize: 'min(1.8vw, 10px)' }}>
              <p className="break-words">毛毛虫文化传播有限公司</p>
              <p>www.nanbende.com</p>
              <p className="mt-[4px]">上架建议：儿童绘本 / 启蒙</p>
            </div>
          </div>

          {/* 装饰脚印 */}
          <div className="absolute rounded-full bg-[#b2ebf2] opacity-50" style={{ width: '20px', height: '14px', bottom: '20%', right: '12%', transform: 'rotate(-20deg)' }} />
          <div className="absolute rounded-full bg-[#b2ebf2] opacity-50" style={{ width: '20px', height: '14px', bottom: '25%', right: '18%', transform: 'rotate(10deg)' }} />
          <div className="absolute rounded-full bg-[#b2ebf2] opacity-50" style={{ width: '20px', height: '14px', bottom: '22%', right: '24%', transform: 'rotate(-15deg)' }} />
        </div>
      </div>
    );
  }

  // 4:3 横向布局 - 平衡布局
  return (
    <div className="w-full h-full flex items-center justify-center relative overflow-hidden" style={{ background: backgroundColor }}>
      {/* 背景装饰 */}
      <div className="absolute rounded-full bg-[rgba(77,208,225,0.1)]" style={{ width: '220px', height: '220px', top: '-60px', left: '-60px' }} />
      <div className="absolute rounded-full bg-[rgba(77,208,225,0.1)]" style={{ width: '160px', height: '160px', bottom: '-40px', right: '-40px' }} />

      <div className="relative z-10 flex flex-col items-center justify-between w-full h-full px-[6%] py-[4%] box-border">
        {/* 顶部：Logo + 标题（横向布局） */}
        <div className="flex items-center justify-center gap-[4%] flex-shrink-0 w-full">
          <div className="w-[110px] h-[110px] bg-white rounded-full p-[3px] shadow-md flex items-center justify-center border-[3px] border-[#4dd0e1] flex-shrink-0">
            <img
              src={logoUrl}
              alt="Logo"
              className="w-full h-full rounded-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
          <div className="text-[#00838f] font-bold text-left leading-tight flex-1" style={{ fontFamily: 'ZCOOL KuaiLe, cursive', fontSize: 'min(3.5vw, 18px)' }}>
            毛毛虫绘本
            <div className="px-2 break-words" style={{ fontSize: 'min(3vw, 14px)' }}>{storybookTitle}</div>
          </div>
        </div>

        {/* 中间：文案区 - 限制行数和字数 */}
        <div className="flex-1 w-full max-w-[88%] my-[3%] flex flex-col justify-center">
          <div className="bg-white/60 rounded-[12px] px-[4%] py-[3%] border-[2px] border-dashed border-[#4dd0e1] w-full h-full">
            <div className="w-full h-full flex flex-col">
              <p className="text-[#546e7a] font-bold mb-[2%] text-center flex-shrink-0" style={{ fontSize: 'min(2.2vw, 13px)' }}>【编者寄语】</p>
              <div
                className="w-full flex-1 text-center leading-relaxed text-[#546e7a] break-words"
                style={{
                  fontSize: 'min(1.8vw, 11px)',
                  lineHeight: '1.6',
                  display: '-webkit-box',
                  WebkitLineClamp: 4,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  wordBreak: 'break-word',
                  maxWidth: '92%'
                }}
              >
                {editorMessage}
              </div>
            </div>
          </div>
        </div>

        {/* 底部：信息栏 */}
        <div className="flex justify-between items-end w-full max-w-[90%] flex-shrink-0">
          <div className="bg-white border border-gray-300 flex items-center justify-center p-[2%] flex-shrink-0" style={{ width: '90px', height: '90px' }}>
            <div className="w-[85%] h-[85%] bg-gray-200 rounded" style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 2px,#000 2px,#000 4px),repeating-linear-gradient(90deg,transparent,transparent 2px,#000 2px,#000 4px)', backgroundSize: '4px 4px' }} />
          </div>

          <div className="text-right text-[#78909c] leading-snug flex-1 ml-[3%]" style={{ fontSize: 'min(2.2vw, 11px)' }}>
            <p className="truncate">毛毛虫文化传播有限公司</p>
            <p>www.nanbende.com</p>
            <p className="mt-[4px]">上架建议：儿童绘本 / 启蒙</p>
          </div>
        </div>

        {/* 装饰脚印 */}
        <div className="absolute rounded-full bg-[#b2ebf2] opacity-50" style={{ width: '16px', height: '11px', bottom: '15%', left: '8%', transform: 'rotate(-20deg)' }} />
        <div className="absolute rounded-full bg-[#b2ebf2] opacity-50" style={{ width: '16px', height: '11px', bottom: '20%', left: '14%', transform: 'rotate(10deg)' }} />
        <div className="absolute rounded-full bg-[#b2ebf2] opacity-50" style={{ width: '16px', height: '11px', bottom: '17%', left: '20%', transform: 'rotate(-15deg)' }} />
      </div>
    </div>
  );
};

export default Fresh;
