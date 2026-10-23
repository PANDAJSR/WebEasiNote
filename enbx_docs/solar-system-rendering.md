# SolarSystem 球面渲染与状态恢复

## 适用范围

`PlanetSystemType=Earth` 整体地球场景。资源来自课件的 `Textures`／`Maps`，不下载外部地图。

## 官方证据

- REA 程序集身份父证据：`ev_bd059059b7d15f420557f795c0c6c3526fb37f194e844d79f99b65a5678273ad`；摘要 `ev_39dd3a46d883d9febb795c6eadbc2f34d566e3895e4d4ff01fda90ec8d0d7692`。
- 官方文件：`EasiNote5_5.2.4.10148/Main/EasiNote.Extension.dll`，SHA-256 `26ce3441637c4a19b22cd6c796c4f5ac4ab350f9b55f03d01aa6f8f9a4b4c8c6`，MVID `ce45ba60-d114-48bd-a6a2-7e4618e08211`。
- `SolarSystemTextureController` 与 `SolarSystemElementSaveInfo` 静态成员父证据：`ev_8d3485e3cd0a2ca9a56159d0361c7e8da7a121ae781e70577c2f40bbdbf333f1`；摘要 `ev_1b09bf6b5aac4e06fbefdfffb593155ef4d06edad4b59d592c4fb62641149d02`。
- 成员页 `ev_adafdb757b52c692e545018f4b617483fbed4eb1a63e3a351dffafa5cdeb7ded` 确认 `GetDstMatrix`／`SetDstMatrix`／`Extent`，方法 token 分别为 `0x060037f7`／`0x060037f8`／`0x060037f6`。控制器同时存在鼠标拖动与滚轮方法。
- 既有研究 `D:/Code/EasiNote-Resarch/topics/subject-cards/official/solarsystemelement.xaml` 第 91–108 行：Helix 三维视口、AmbientLight、二维 TextureImage 使用 Uniform。
- 同目录 `Cvte.EasiNote.Extensions.Subject.SolarSystemElement.decompiled.cs` 第 1064–1078、1130–1142 行：恢复 EarthTextureKey、PlanetView、Texture2DMatrix，以及 CameraPosition／LookDirection／UpDirection。
- 本机测试课件 Slide_16 实际保存 Earth、ThreeD、Overall，距离约 9 的相机，Satellite 与 Earth 引用相同 4096×2048 地球贴图。平面专题地图与球面专题纹理可以引用不同资源，不能混用。

以上均为静态文件证据，不代表已观察官方运行时。

## 实现规则

- 水平 45° 透视视口覆盖整个元素矩形；每条屏幕射线与单位球求交，球外透明。
- 经度由 atan2(Y,X) 映射，纬度由 acos(Z) 映射；保持既有贴图方向。GPU 使用线性过滤；Canvas 回退使用跨经度接缝的双线性采样。
- 使用保存相机的完整向量，旋转同步作用于位置、观察方向和上方向。缩放保留观察方向，不在首次拖动时重新朝向原点。
- 二维六项矩阵直接映射 CSS matrix，新增缩放与平移组合到该矩阵；复位恢复保存值。重新加载元素时清除上一个元素的交互状态。
- 月球、轨道仍为原有静态近似；未恢复太阳系、剖面、百科、标记、真实天体运动、天空纹理或官方光照算法。

## 验证与限制

`tests/solar-system.test.tsx` 覆盖完整视口、相机偏移、近距离裁切、球体宽高比、纹理接缝、相机旋转／缩放、二维矩阵、地图切换、拖动取消、复位、重新加载及编辑状态。

主会话已在 Chromium 实际创建 WebGL 上下文并编译 shader：同步读取合成蓝色纹理的球心像素为 `[0,91,184,255]`，球外像素透明，`gl.getError()=0`。加载测试课件 `Slides/Slide_16.xml` 的 16 项真实球面纹理资源，1600×900 绘制视口无纹理加载错误，放大按钮交互正常，WebGL 错误码为 0。四线三格私有字体也在同一浏览器中确认状态为 loaded。

Canvas 投影通过真实像素测试；尚未完成 WebGL／Canvas 完整图像一致性比较或与官方运行窗口的逐像素对照。桌面截图工具因窗口不可见拒绝截图，此限制不影响已完成的脚本和像素读取验证。
