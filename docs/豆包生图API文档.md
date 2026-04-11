## 图片生成能力简介
doubao-seedream-5.0-litenew、doubao-seedream-4.5/4.0
生成组图（组图：基于您输入的内容，生成的一组内容关联的图片；需配置 sequential_image_generation 为auto）
多图生组图，根据您输入的 多张参考图片（2-14）+文本提示词 生成一组内容关联的图片（输入的参考图数量+最终生成的图片数量≤15张）。
单图生组图，根据您输入的 单张参考图片+文本提示词 生成一组内容关联的图片（最多生成14张图片）。
文生组图，根据您输入的 文本提示词 生成一组内容关联的图片（最多生成15张图片）。
生成单图（配置 sequential_image_generation 为disabled）
多图生图，根据您输入的 多张参考图片（2-14）+文本提示词 生成单张图片。
单图生图，根据您输入的 单张参考图片+文本提示词 生成单张图片。
文生图，根据您输入的 文本提示词 生成单张图片。


## 请求参数


- image string/array 
输入的图片信息，支持 URL 或 Base64 编码。其中，doubao-seedream-5.0-lite/4.5/4.0 支持单图或多图输入（查看多图融合示例）。
图片URL：请确保图片URL可被访问。
Base64编码：请遵循此格式data:image/<图片格式>;base64,<Base64编码>。注意 <图片格式> 需小写，如 data:image/png;base64,<base64_image>。
说明
传入单张图片要求：
图片格式：jpeg、png（doubao-seedream-5.0-lite/4.5/4.0 模型新增支持 webp、bmp、tiff、gif 格式new）
宽高比（宽/高）范围：
[1/16, 16] (适用模型：doubao-seedream-5.0-lite/4.5/4.0）
[1/3, 3] (适用模型：doubao-seedream-3.0-t2i）
宽高长度（px） > 14
大小：不超过 10MB
总像素：不超过 6000x6000=36000000 px （对单张图宽度和高度的像素乘积限制，而不是对宽度或高度的单独值进行限制）
doubao-seedream-5.0-lite/4.5/4.0 最多支持传入 14 张参考图。

- sequential_image_generation string 默认值 disabled
仅 doubao-seedream-5.0-lite/4.5/4.0 支持该参数 | 查看组图输出示例控制是否关闭组图功能。
说明
组图：基于您输入的内容，生成的一组内容关联的图片。
auto：自动判断模式，模型会根据用户提供的提示词自主判断是否返回组图以及组图包含的图片数量。
disabled：关闭组图功能，模型只会生成一张图。

sequential_image_generation_options object
仅 doubao-seedream-5.0-lite/4.5/4.0 支持该参数组图功能的

- toolsnew  array of object
仅 doubao-seedream-5.0-lite 支持该参数
tools.type string  
指定使用的工具类型。
web_search：联网搜索功能。
说明
开启联网搜索后，模型会根据用户的提示词自主判断是否搜索互联网内容（如商品、天气等），提升生成图片的时效性，但也会增加一定的时延。
实际搜索次数可通过字段 usage.tool_usage.web_search 查询，如果为 0 表示未搜索。

- stream  Boolean 默认值 false
仅 doubao-seedream-5.0-lite/4.5/4.0 支持该参数 | 查看流式输出示例控制是否开启流式输出模式。
false：非流式输出模式，等待所有图片全部生成结束后再一次性返回所有信息。
true：流式输出模式，即时返回每张图片输出的结果。在生成单图和组图的场景下，流式输出模式均生效。

- guidance_scale  Float 
doubao-seedream-3.0-t2i 默认值 2.5doubao-seedream-5.0-lite/4.5/4.0 不支持模型输出结果与prompt的一致程度，生成图像的自由度，又称为文本权重；值越大，模型自由度越小，与用户输入的提示词相关性越强。
取值范围：[1, 10] 。

- output_formatnewstring 默认值 jpeg
仅 doubao-seedream-5.0-lite 支持该参数指定生成图像的文件格式。可选值：
png
jpeg
说明
doubao-seedream-4.5/4.0、doubao-seedream-3.0-t2i 模型生成图像的文件格式默认为 jpeg，不支持自定义设置。

- response_format string 默认值 url
指定生成图像的返回格式。支持以下两种返回方式：
url：返回图片下载链接；链接在图片生成后24小时内有效，请及时下载图片。
b64_json：以 Base64 编码字符串的 JSON 格式返回图像数据。

- watermark  Boolean 默认值 true
是否在生成的图片中添加水印。
false：不添加水印。
true：在图片右下角添加“AI生成”字样的水印标识。