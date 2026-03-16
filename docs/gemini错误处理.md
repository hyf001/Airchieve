Gemini 3 Pro Image Preview API 错误处理指南
为开发者提供的 gemini-3-pro-image-preview API 错误处理最佳实践与用户友好提示方案
附上 官网生成式内容的常见错误说明 https://ai.google.dev/api/generate-content?hl=zh-cn
📋 目录
1. 概述
2. 核心判断指标
3. 错误场景与处理流程
4. C 端用户友好提示文案
5. 完整处理流程图
6. 代码实现示例
7. 最佳实践建议

---
概述
API 基本信息
- 模型代码: gemini-3-pro-image-preview
- API 端点: https://api.apiyi.com/v1beta/models/gemini-3-pro-image-preview:generateContent
- 知识库截止: 2025年1月
- 官方文档: Google AI 文档
为什么需要专门的错误处理？
Google Gemini API 对内容安全有严格控制，会在多个层级拒绝不合规的请求。简单的"生成失败"提示无法帮助用户理解问题，需要：
✅ 精准识别拒绝原因 - 区分内容违规、知识库限制、技术错误等
✅ 友好的用户提示 - 将技术错误转化为可理解的说明
✅ 可操作的建议 - 告诉用户如何修改才能成功
✅ 完整的技术信息 - 供开发者调试和排查问题

完整输出结构示例
完整接口响应 (原始JSON):
{
  "candidates": [
    {
      "content": {
        "parts": null
      },
      "finishReason": "IMAGE_SAFETY",
      "finishMessage": "Unable to show the generated image. The image was filtered out because it violated Google's [Generative AI Prohibited Use policy](https://policies.google.com/terms/generative-ai/use-policy). You will not be charged for blocked images. Try rephrasing the prompt. If you think this was an error, [send feedback](https://ai.google.dev/gemini-api/docs/troubleshooting).",
      "index": 0
    }
  ],
  "promptFeedback": {
    "safetyRatings": null
  },
  "usageMetadata": {
    "promptTokenCount": 464,
    "candidatesTokenCount": 0,
    "totalTokenCount": 755,
    "thoughtsTokenCount": 291,
    "promptTokensDetails": [
      {
        "modality": "TEXT",
        "tokenCount": 206
      },
      {
        "modality": "IMAGE",
        "tokenCount": 258
      }
    ]
  },
  "modelVersion": "gemini-3-pro-image-preview",
  "responseId": "BK54aczcOKL***PsqekqA4"
}



---
核心判断指标
1. candidatesTokenCount（最高优先级）⭐
位置: response.usageMetadata.candidatesTokenCount
含义: API 生成的候选内容的 token 数量
判断规则:
if (candidatesTokenCount === 0) {
    // 谷歌内容审核阶段就直接拒绝
    // 这是最严格的拒绝，连候选内容都不生成
}
典型响应:
{
  "candidates": null,
  "usageMetadata": {
    "promptTokenCount": 271,
    "candidatesTokenCount": 0,  // ⚠️ 关键指标
    "totalTokenCount": 271
  }
}
推荐文案:
❌ 内容审核失败
您的提示词或图片包含不适当内容，已被安全策略拒绝。
请修改后重试，若无修改还是不会成功生成图片的。

---
2. finishReason（次优先级）
位置: response.candidates[0].finishReason
含义: API 处理结束的原因
判断规则:
if (finishReason !== 'STOP') {
    // 非正常结束，需要特殊处理
}
常见值与含义:
finishReason
含义
用户友好文案
STOP
正常结束
-
PROHIBITED_CONTENT
违禁内容
"内容违反安全策略，已被拒绝处理"
SAFETY
安全过滤
"内容触发了安全过滤器"
RECITATION
引用限制
"内容可能涉及版权问题"
MAX_TOKENS
Token 超限
"内容长度超出限制"
典型响应:
{
  "candidates": [{
    "content": {
      "parts": null
    },
    "finishReason": "PROHIBITED_CONTENT",
    "index": 0
  }]
}
推荐文案:
❌ 内容违反安全策略
检测到违禁内容（如色情、暴力、仇恨言论等）。
请检查您的提示词，确保内容健康、正面。

---
3. API 文本响应（重要）
位置: response.candidates[0].content.parts[].text
含义: API 返回的文本说明（可能是中文或英文）
判断规则:
if (parts 中有 text 但没有图片数据) {
    // API 返回了拒绝说明，而不是图片
}
典型响应（中文）:
{
  "candidates": [{
    "content": {
      "parts": [{
        "text": "我不能为你创建带有色情、不雅或冒犯性内容的图像。这违反了我们的安全政策。"
      }]
    },
    "finishReason": "STOP"
  }]
}
典型响应（英文）:
{
  "candidates": [{
    "content": {
      "parts": [{
        "text": "I can't generate images that are sexually explicit."
      }]
    },
    "finishReason": "STOP"
  }]
}
推荐文案:
❌ 内容违反安全策略
[直接展示 API 返回的 text 内容]

建议：
• 请根据提示调整您的请求内容
• 确保提示词和图片符合使用政策

---
错误场景与处理流程
场景 1: 谷歌内容审核拒绝（最早期拒绝）
检测条件:
usageMetadata.candidatesTokenCount === 0
API 响应:
{
  "candidates": null,
  "promptFeedback": { "safetyRatings": null },
  "usageMetadata": {
    "promptTokenCount": 271,
    "candidatesTokenCount": 0,
    "totalTokenCount": 271
  }
}
C 端用户文案示例:
标题：❌ 内容审核未通过
说明：您的请求在内容审核阶段被拒绝。
建议：
• 请检查提示词，确保不包含敏感内容
• 如使用参考图，请确保图片内容健康
• 避免描述暴力、色情等不适当内容
B 端/开发测试文案:
标题：谷歌内容审核拒绝
说明：检测到 candidatesTokenCount 为 0
技术详情：
• candidatesTokenCount: 0
• promptTokenCount: 271
• 完整响应：[JSON 数据]

---
场景 2: finishReason 拒绝（生成过程拒绝）
检测条件:
finishReason !== 'STOP' && content.parts === null
API 响应:
{
  "candidates": [{
    "content": { "parts": null },
    "finishReason": "PROHIBITED_CONTENT",
    "index": 0,
    "safetyRatings": null
  }]
}
C 端用户文案示例:
标题：❌ 内容不符合要求
说明：您的请求包含不适当内容，无法生成图片。
建议：
• 请使用健康、正面的描述
• 避免涉及敏感话题
• 重新调整提示词后再试
B 端/开发测试文案:
标题：API 拒绝处理：违禁内容
说明：finishReason: PROHIBITED_CONTENT
Candidate 结构：[完整 JSON]

---
场景 3: API 文本响应（返回说明文本）
检测条件:
finishReason === 'STOP' && 
有 text 内容 && 
无图片数据
API 响应（中文）:
{
  "candidates": [{
    "content": {
      "role": "model",
      "parts": [{
        "text": "我不能为你创建带有色情、不雅或冒犯性内容的图像。这违反了我们的安全政策。",
        "thoughtSignature": "..."
      }]
    },
    "finishReason": "STOP",
    "index": 0
  }],
  "usageMetadata": {
    "candidatesTokenCount": 24
  }
}
API 响应（英文）:
{
  "candidates": [{
    "content": {
      "parts": [{
        "text": "I can't generate images that are sexually explicit.",
        "thoughtSignature": "..."
      }]
    },
    "finishReason": "STOP"
  }],
  "usageMetadata": {
    "candidatesTokenCount": 11
  }
}
C 端用户文案示例:
标题：❌ 无法生成图片
说明：[直接展示 API 返回的 text 内容]
     "我不能为你创建带有色情、不雅或冒犯性内容的图像。这违反了我们的安全政策。"
     或
     "I can't generate images that are sexually explicit."

建议：
• 请根据提示调整您的请求
• 确保内容符合使用政策
智能识别（可选）:
如果能识别 text 中的关键词（sexually、explicit、色情、不雅等），可以提供更具体的提示：
标题：❌ 内容违反安全策略
说明：检测到色情或不适当内容相关的请求。
详细说明：[API 返回的原始文本]
建议：
• NSFW 或色情内容不被允许
• 请调整提示词，确保内容健康

---
场景 4: 知识库限制
检测条件:
text 中包含未来年份（2026+）或未发布产品
示例:
- "将手机改为 iPhone 17"
- "添加 2026 年的汽车"
C 端用户文案示例:
标题：❌ 内容超出支持范围
说明：您提到的内容可能超出了 AI 的知识范围（知识库更新至 2025年1月）。
建议：
• 使用已存在的产品或概念
• 避免引用未来的产品
• 使用通用的描述方式

---
场景 5: 去水印/换脸等禁止功能
检测条件:
text 中包含关键词：watermark、faceswap、remove 等
API 响应（典型）:
{
  "candidates": [{
    "content": {
      "parts": [{
        "text": "I'm just a language model and can't help with that."
      }]
    },
    "finishReason": "STOP"
  }]
}
C 端用户文案示例:
去水印:
标题：❌ 功能不支持
说明：去水印功能违反内容政策，无法处理。
建议：
• 使用专业的图片编辑软件
• 或调整请求，专注于其他编辑需求
换脸:
标题：❌ 功能不支持
说明：换脸功能涉及隐私和伦理问题，无法处理。
建议：
• 使用专门的换脸应用
• 注意合法合规使用

---
C 端用户友好提示文案
文案设计原则
1. 简洁明了 - 避免技术术语
2. 正面引导 - 告诉用户怎么做，而不是只说不行
3. 可操作 - 提供具体的修改建议
4. 避免指责 - 不要让用户感到被批评
推荐文案模板
❌ 内容不符合要求
您的请求包含不适当内容，无法生成图片。

💡 建议：
• 请使用健康、正面的描述
• 避免涉及敏感话题
• 重新调整提示词后再试
❌ 功能暂不支持
该功能暂不支持，请尝试其他编辑方式。

💡 建议：
• 使用其他专业工具
• 或调整您的编辑需求
❌ 内容超出范围
您提到的内容可能超出了 AI 的知识范围。

💡 建议：
• 使用常见的物品或概念
• 避免引用未来的产品
✅ 技术错误（网络等）
网络连接出现问题，请稍后重试。

💡 建议：
• 检查网络连接
• 点击"重试"按钮
• 或稍后再试

---
完整处理流程图
收到 API 响应
    │
    ├─ 1️⃣ 检查 usageMetadata.candidatesTokenCount
    │   ├─ = 0 ────→ 【谷歌内容审核拒绝】
    │   │              ├─ C端: "内容审核未通过"
    │   │              └─ B端: "candidatesTokenCount: 0 + 完整响应"
    │   └─ > 0 ────→ 继续检查
    │
    ├─ 2️⃣ 检查 candidates
    │   ├─ null 或 空数组 ────→ 【API 格式错误】
    │   │                        ├─ C端: "系统出错，请稍后重试"
    │   │                        └─ B端: "candidates 为空 + 完整响应"
    │   └─ 存在 ────→ 继续检查
    │
    ├─ 3️⃣ 检查 finishReason
    │   ├─ ≠ 'STOP' ────→ 【finishReason 拒绝】
    │   │   ├─ PROHIBITED_CONTENT → "内容违反安全策略"
    │   │   ├─ SAFETY → "触发了安全过滤器"
    │   │   ├─ RECITATION → "可能涉及版权问题"
    │   │   └─ 其他 → 使用映射表或显示原始值
    │   └─ = 'STOP' ────→ 继续检查
    │
    ├─ 4️⃣ 检查 content.parts
    │   ├─ null 或 空 ────→ 【内容为空】
    │   │                   └─ 同 finishReason 处理
    │   └─ 存在 ────→ 继续检查
    │
    ├─ 5️⃣ 提取图片数据和文本响应
    │   ├─ 遍历 parts
    │   │   ├─ 收集 text（即使有 thoughtSignature）
    │   │   └─ 收集图片数据（inlineData.data）
    │   └─ 统计结果
    │
    ├─ 6️⃣ 检查是否有图片
    │   ├─ 有图片 ────→ ✅ 成功返回
    │   └─ 无图片 ────→ 继续检查
    │
    └─ 7️⃣ 检查是否有文本响应
        ├─ 有文本 ────→ 【文本响应处理】
        │   ├─ 智能识别关键词
        │   │   ├─ 能识别 → 使用智能提示
        │   │   └─ 不能识别 → 直接展示 API 文本
        │   └─ C端: 直接展示 text 内容
        │       B端: text 内容 + 完整响应
        └─ 无文本 ────→ 【通用错误】
            ├─ C端: "生成失败，请重试"
            └─ B端: "未找到图片数据 + 完整响应"

---
代码实现示例
1. 响应解析与错误检测
async function processGeminiResponse(data) {
    // 1️⃣ 最高优先级：检查 candidatesTokenCount
    if (data.usageMetadata?.candidatesTokenCount === 0) {
        return {
            success: false,
            errorType: 'ZERO_CANDIDATES_TOKEN',
            userMessage: '您的请求在内容审核阶段被拒绝，请修改后重试',
            devMessage: 'candidatesTokenCount: 0 - 谷歌内容审核拒绝',
            rawResponse: data
        };
    }
    
    // 2️⃣ 检查 candidates
    if (!data.candidates || !data.candidates.length) {
        return {
            success: false,
            errorType: 'NO_CANDIDATES',
            userMessage: '系统出错，请稍后重试',
            devMessage: 'candidates 为 null 或空数组',
            rawResponse: data
        };
    }
    
    const candidate = data.candidates[0];
    
    // 3️⃣ 检查 finishReason
    if (candidate.finishReason && candidate.finishReason !== 'STOP') {
        const reasonMessages = {
            'PROHIBITED_CONTENT': '内容违反安全策略，已被拒绝处理',
            'SAFETY': '内容触发了安全过滤器',
            'RECITATION': '内容可能涉及版权问题',
            'MAX_TOKENS': '内容长度超出限制'
        };
        
        return {
            success: false,
            errorType: 'FINISH_REASON',
            finishReason: candidate.finishReason,
            userMessage: reasonMessages[candidate.finishReason] || 
                        `请求被拒绝：${candidate.finishReason}`,
            devMessage: `finishReason: ${candidate.finishReason}`,
            candidateStructure: candidate,
            rawResponse: data
        };
    }
    
    // 4️⃣ 检查 content.parts
    if (!candidate.content?.parts) {
        return {
            success: false,
            errorType: 'NO_PARTS',
            userMessage: '生成失败，请重试',
            devMessage: 'candidate.content.parts 为空',
            candidateStructure: candidate,
            rawResponse: data
        };
    }
    
    // 5️⃣ 提取图片和文本
    const images = [];
    const texts = [];
    
    for (const part of candidate.content.parts) {
        // 先收集文本（重要：即使有 thoughtSignature 也要收集）
        if (part.text && !part.text.startsWith('data:image/')) {
            texts.push(part.text);
        }
        
        // 收集图片
        if (part.inlineData?.data) {
            const dataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            images.push(dataUrl);
        }
    }
    
    // 6️⃣ 检查是否有图片
    if (images.length > 0) {
        return {
            success: true,
            images: images,
            texts: texts // 可能有附加说明文本
        };
    }
    
    // 7️⃣ 无图片，检查是否有文本响应
    if (texts.length > 0) {
        const textContent = texts.join('\n');
        
        // 智能识别（可选）
        const detectedType = detectContentType(textContent);
        
        return {
            success: false,
            errorType: 'TEXT_RESPONSE',
            userMessage: textContent, // 直接使用 API 的文本
            detectedType: detectedType, // 'nsfw', 'watermark', 'general' 等
            devMessage: `API 返回文本响应，长度: ${textContent.length}`,
            apiText: textContent,
            rawResponse: data
        };
    }
    
    // 8️⃣ 兜底：完全没有数据
    return {
        success: false,
        errorType: 'UNKNOWN',
        userMessage: '生成失败，请检查提示词后重试',
        devMessage: '未找到图片数据或文本响应',
        rawResponse: data
    };
}
2. 关键词智能识别
function detectContentType(text) {
    const lowerText = text.toLowerCase();
    
    // 拒绝模式检测
    const isRejection = 
        lowerText.includes("i can't generate") ||
        lowerText.includes("i cannot generate") ||
        lowerText.includes("i can't create") ||
        lowerText.includes("i'm just a language model") ||
        lowerText.includes("我不能") ||
        lowerText.includes("无法生成");
    
    if (!isRejection) {
        return null;
    }
    
    // 细分拒绝类型
    if (lowerText.includes('watermark')) {
        return 'watermark_removal';
    }
    
    if (lowerText.includes('faceswap') || lowerText.includes('face swap')) {
        return 'faceswap';
    }
    
    if (lowerText.includes('sexually') || 
        lowerText.includes('explicit') ||
        lowerText.includes('色情') ||
        lowerText.includes('不雅')) {
        return 'nsfw';
    }
    
    return 'general_rejection';
}
3. 前端展示逻辑
function showErrorToUser(errorResult) {
    if (errorResult.success) {
        // 显示图片
        displayImages(errorResult.images);
        return;
    }
    
    // 错误处理
    let title, message, suggestions;
    
    switch(errorResult.errorType) {
        case 'ZERO_CANDIDATES_TOKEN':
            title = '内容审核未通过';
            message = errorResult.userMessage;
            suggestions = [
                '请检查提示词，确保不包含敏感内容',
                '如使用参考图，请确保图片内容健康'
            ];
            break;
            
        case 'FINISH_REASON':
            title = '内容不符合要求';
            message = errorResult.userMessage;
            suggestions = [
                '请使用健康、正面的描述',
                '避免涉及敏感话题'
            ];
            break;
            
        case 'TEXT_RESPONSE':
            title = '无法生成图片';
            message = errorResult.userMessage; // API 的原始文本
            suggestions = [
                '请根据提示调整您的请求',
                '确保内容符合使用政策'
            ];
            break;
            
        default:
            title = '生成失败';
            message = errorResult.userMessage;
            suggestions = ['请检查提示词后重试'];
    }
    
    // 显示错误弹窗
    showErrorModal({
        title: title,
        message: message,
        suggestions: suggestions,
        // 开发测试模式下显示完整信息
        technicalDetails: {
            errorType: errorResult.errorType,
            devMessage: errorResult.devMessage,
            rawResponse: errorResult.rawResponse
        }
    });
}

---
最佳实践建议
1. 优先级排序 ⭐
错误检测应按以下顺序进行：
1. candidatesTokenCount === 0     (最早期拒绝)
2. finishReason !== 'STOP'         (生成过程拒绝)
3. content.parts 检查               (结构完整性)
4. 提取图片和文本                   (数据提取)
5. 智能识别文本内容                 (语义分析)
2. 文本收集注意事项 ⚠️
关键：必须在判断 thoughtSignature 之前收集 text
// ✅ 正确做法
// 先收集文本
if (part.text && !part.text.startsWith('data:image/')) {
    texts.push(part.text);
}

// 再判断是否跳过
if (hasThoughtSignature && !part.inlineData) {
    continue; // 跳过图片检查
}

// ❌ 错误做法
if (hasThoughtSignature) {
    continue; // 直接跳过，text 没被收集
}

if (part.text) {
    texts.push(part.text); // 永远执行不到
}
3. 响应数据保留 📦
开发测试工具必须保留完整响应：
error.detailedError = {
    rawResponse: JSON.stringify(data, null, 2), // 完整 JSON
    candidateStructure: candidate ? JSON.stringify(candidate, null, 2) : null,
    errorData: data
};
展示建议：
- C 端用户：默认不展示技术详情
- B 端用户：默认展开技术详情
- 开发者：提供"展开/收起"切换
4. 多语言支持 🌍
API 可能返回中文或英文说明，需要都支持：
const rejectionPatterns = [
    // 英文
    "i can't generate",
    "i cannot create",
    "i'm just a language model",
    // 中文
    "我不能",
    "无法生成",
    "违反.*政策"
];
5. 友好降级 📉
// 优先级降级
if (能智能识别) {
    展示智能提示 + API 文本;
} else if (有 API 文本) {
    直接展示 API 文本;
} else if (有 finishReason) {
    展示 finishReason 友好名称;
} else {
    展示通用提示 + 完整响应;
}
6. 永不显示"未知错误" 🚫
// ❌ 错误做法
return { error: '未知错误' };

// ✅ 正确做法
return { 
    error: error?.message || '生成失败，请查看详细信息',
    rawResponse: JSON.stringify(data, null, 2)
};

---
关键代码片段
thoughtSignature 处理
// ⚠️ 注意：有 thoughtSignature 的 part 仍然可能包含重要的 text
for (const part of candidate.content.parts) {
    const hasThoughtSignature = !!part.thoughtSignature;
    
    // ✅ 先收集文本（重要！）
    if (part.text && typeof part.text === 'string' && !part.text.startsWith('data:image/')) {
        apiTextResponses.push(part.text);
    }
    
    // ✅ 再决定是否跳过后续图片检查
    if (hasThoughtSignature && part.text && !part.inlineData) {
        continue; // 跳过图片检查，但 text 已经收集了
    }
    
    // 提取图片数据...
}
错误消息优先级
// 生成错误消息时的优先级
let errorMessage;

if (apiTextResponses && apiTextResponses.length > 0) {
    // 优先使用 API 返回的文本
    errorMessage = apiTextResponses.join('\n');
} else if (finishReason && finishReason !== 'STOP') {
    // 使用 finishReason 友好名称
    errorMessage = finishReasonNames[finishReason] || finishReason;
} else {
    // 兜底提示
    errorMessage = '未找到图片数据，请检查提示词后重试';
}

---
错误响应示例汇总
✅ 完整的测试用例
用例 1: candidatesTokenCount = 0
{
  "candidates": null,
  "usageMetadata": { "candidatesTokenCount": 0 }
}
处理: 谷歌内容审核拒绝

---
用例 2: finishReason = PROHIBITED_CONTENT
{
  "candidates": [{
    "content": { "parts": null },
    "finishReason": "PROHIBITED_CONTENT"
  }]
}
处理: finishReason 拒绝

---
用例 3: 有中文文本响应
{
  "candidates": [{
    "content": {
      "parts": [{
        "text": "我不能为你创建带有色情、不雅或冒犯性内容的图像。这违反了我们的安全政策。"
      }]
    },
    "finishReason": "STOP"
  }],
  "usageMetadata": { "candidatesTokenCount": 24 }
}
处理: 直接展示中文说明

---
用例 4: 有英文文本响应
{
  "candidates": [{
    "content": {
      "parts": [{
        "text": "I can't generate images that are sexually explicit.",
        "thoughtSignature": "..."
      }]
    },
    "finishReason": "STOP"
  }],
  "usageMetadata": { "candidatesTokenCount": 11 }
}
处理: 识别为 NSFW，展示英文说明

---
用例 5: 正常成功
{
  "candidates": [{
    "content": {
      "parts": [{
        "inlineData": {
          "mimeType": "image/jpeg",
          "data": "base64图片数据..."
        }
      }]
    },
    "finishReason": "STOP"
  }],
  "usageMetadata": { "candidatesTokenCount": 125 }
}
处理: 提取图片，成功返回

---
常见问题 FAQ
Q1: 为什么同一个提示词有时能生成有时不能？
A: Google API 的安全过滤有随机性和上下文相关性：
- 参考图的内容会影响判断
- 提示词的组合方式会影响判断
- 建议：调整描述方式，使用更委婉的表达
Q2: 如何区分是内容问题还是技术问题？
A: 看错误类型：
- candidatesTokenCount: 0 或 finishReason: PROHIBITED_CONTENT → 内容问题
- Failed to fetch 或 HTTP 错误 → 技术问题
- 有 API 文本说明 → 通常是内容问题
Q3: C 端用户应该看到多少技术信息？
A: 建议分层展示：
- 默认显示: 友好的错误说明 + 修改建议
- 可选展开: 技术详情（供高级用户）
- 开发模式: 完整的 JSON 响应
Q4: 是否需要为每个 finishReason 写特定处理？
A: 不需要！使用映射表 + 通用处理：
const finishReasonMessages = {
    'PROHIBITED_CONTENT': '内容违反安全策略',
    'SAFETY': '触发安全过滤器',
    // ... 可扩展
};

// 通用处理
const message = finishReasonMessages[finishReason] || 
                `请求被拒绝：${finishReason}`;

---
参考资源
- Google 官方文档: https://ai.google.dev/gemini-api/docs/models?hl=zh-cn#gemini-3-pro-image-preview
- 本项目 FAQ: nano-banana-faq.md
- 代码实现: js/api.js - processImageResponse 方法

---
更新日志
- 2025-12-07: 初始版本
  - 完整的错误处理流程图
  - C 端用户友好文案示例
  - 代码实现示例
  - 最佳实践建议

---
提示: 本文档基于实际开发测试经验总结，建议开发者根据自己的应用场景调整用户提示文案的详细程度。