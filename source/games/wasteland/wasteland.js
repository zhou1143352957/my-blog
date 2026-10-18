/**
 * 废土余生 Wasteland Survival —— 俯视生存 · 六区撤离
 *
 * 俯视角双摇杆式生存搜刮：白天在手工搭建的废墟街区里翻箱倒柜，
 * 入夜断电、尸潮压上来，带着战利品跑到撤离点。
 *
 * 美术全部由 Canvas 逐帧程序化绘制，不依赖任何图片素材：
 * 世界层（路面、楼顶、车壳、管线、污渍、阴影）一次性烘焙进世界画布，
 * 运行时只画会动的东西 —— 人、子弹、火、雾、光。
 * 夜戏用「暗场 + 挖光洞 + 加色泛光」三层合成，枪口、路灯、火光和手电
 * 都是真实光源，不再是叠一层半透明黑。
 *
 * 页面脚本带 data-pjax：Pjax 切页会重复执行，挂载前先销毁旧实例。
 */
(function () {
    'use strict';

    // ============================================================ 基础配置
    const TAU = Math.PI * 2;
    const DEG = Math.PI / 180;

    const CFG = {
        viewH: 620,
        player: {
            r: 13, speed: 208, sprint: 318, accel: 1900, friction: 2300,
            hp: 100, armorMax: 100, searchBase: 1.0, dodgeSpeed: 620,
            dodgeTime: 0.26, dodgeCool: 1.35, stamina: 100
        },
        weapons: {
            switchTime: 0.28,
            dropLife: 26
        },
        night: {
            fadeIn: 3.2, firstWave: 2.0, waveGap: 3.6,
            maxAliveBase: 11, maxAlivePerLevel: 2,
            hpBase: 62, hpPerLevel: 14,
            speedBase: 64, speedPerLevel: 4,
            dmgBase: 9, dmgPerLevel: 1.1
        },
        zombie: {
            biteCool: 0.85, biteWind: 0.42, separation: 44,
            corpseMax: 36, hearRadius: 520
        },
        loot: { radius: 58, ringRadius: 30 },
        exit: { radius: 88 },
        grid: 34,
        maxParticles: 520,
        storeKey: 'wasteland-topdown-v1',
        legacyKey: 'wasteland-progress'
    };

    // ============================================================ 主题
    // 每关一套完整的环境色：地面、沥青、混凝土、楼体、雾、天气、夜色调。
    const THEMES = {
        rust: {
            name: '锈尘黄昏', weather: 'ash',
            base: '#3b3328', baseDark: '#2b251d', baseLight: '#4a4133',
            asphalt: '#322f2a', asphalt2: '#3b3832', asphaltLine: '#b8a374',
            concrete: '#6a6153', concrete2: '#79705f', curb: '#8a8070',
            dirt: '#433829', dirt2: '#4e4231', grass: '#4a4a32',
            roof: '#4a4137', roof2: '#3a332c', wall: '#5c5346', wall2: '#463f35',
            trim: '#26221d', metal: '#6f746f', rust: '#8a4a2e',
            fog: 'rgba(108, 88, 66, 0.10)', haze: 'rgba(255, 157, 92, 0.08)',
            night: '#04070c', accent: '#ff9d5c', accent2: '#ffd08a',
            lit: '#ffc37a', blood: '#5f2118', water: '#1c2a2d'
        },
        overpass: {
            name: '灰烬立交', weather: 'ash',
            base: '#343733', baseDark: '#262925', baseLight: '#424641',
            asphalt: '#2e3230', asphalt2: '#373b38', asphaltLine: '#c3bfa4',
            concrete: '#6c6d65', concrete2: '#7b7c73', curb: '#8c8d82',
            dirt: '#3b3a31', dirt2: '#46453a', grass: '#464b34',
            roof: '#454a46', roof2: '#373b37', wall: '#565c56', wall2: '#424742',
            trim: '#202421', metal: '#71796f', rust: '#7d4a30',
            fog: 'rgba(120, 128, 120, 0.11)', haze: 'rgba(193, 208, 186, 0.06)',
            night: '#03070b', accent: '#e3c47c', accent2: '#f5e2b3',
            lit: '#ffd79a', blood: '#57201a', water: '#182527'
        },
        neon: {
            name: '霓虹雨夜', weather: 'rain',
            base: '#2e2b33', baseDark: '#211f26', baseLight: '#3a3640',
            asphalt: '#24242b', asphalt2: '#2d2d35', asphaltLine: '#b9b28e',
            concrete: '#67636b', concrete2: '#76717a', curb: '#8b8590',
            dirt: '#37312c', dirt2: '#423a33', grass: '#3f473c',
            roof: '#3f3b46', roof2: '#322e38', wall: '#554e5b', wall2: '#403a46',
            trim: '#1d1a22', metal: '#6d7078', rust: '#844431',
            fog: 'rgba(110, 100, 130, 0.10)', haze: 'rgba(255, 90, 140, 0.05)',
            night: '#04060e', accent: '#ff5f8f', accent2: '#7af0e0',
            lit: '#ffd0a0', blood: '#5a1d20', water: '#151d2b'
        },
        subway: {
            name: '地铁深处', weather: 'drip',
            base: '#262c2d', baseDark: '#1a1f20', baseLight: '#333a3b',
            asphalt: '#1f2425', asphalt2: '#272c2d', asphaltLine: '#a9a58c',
            concrete: '#5b6363', concrete2: '#6a7272', curb: '#7e8684',
            dirt: '#2c2d28', dirt2: '#353630', grass: '#353f36',
            roof: '#333a3b', roof2: '#272d2e', wall: '#464e4e', wall2: '#333a3a',
            trim: '#171b1c', metal: '#646d6d', rust: '#70412d',
            fog: 'rgba(80, 98, 100, 0.14)', haze: 'rgba(123, 220, 214, 0.04)',
            night: '#020508', accent: '#63e0d5', accent2: '#c8fff7',
            lit: '#d8fff8', blood: '#4f1a18', water: '#102022'
        },
        fire: {
            name: '燃油余烬', weather: 'ember',
            base: '#39322a', baseDark: '#2a241d', baseLight: '#483e33',
            asphalt: '#2b2925', asphalt2: '#34312c', asphaltLine: '#c9b68a',
            concrete: '#706759', concrete2: '#807665', curb: '#918775',
            dirt: '#3e3327', dirt2: '#4a3d2d', grass: '#44432c',
            roof: '#4b4238', roof2: '#3b342c', wall: '#5f5547', wall2: '#484035',
            trim: '#241f19', metal: '#747a75', rust: '#8f4c2c',
            fog: 'rgba(120, 88, 58, 0.11)', haze: 'rgba(255, 141, 66, 0.10)',
            night: '#05070a', accent: '#ff8a3d', accent2: '#ffd27f',
            lit: '#ffcf8a', blood: '#5c1f17', water: '#1a2627'
        },
        quarantine: {
            name: '冷雨隔离区', weather: 'rain',
            base: '#31363a', baseDark: '#23272b', baseLight: '#3e4448',
            asphalt: '#272c30', asphalt2: '#30363a', asphaltLine: '#c0c3b4',
            concrete: '#666d70', concrete2: '#757d80', curb: '#878f92',
            dirt: '#3a3a33', dirt2: '#45453c', grass: '#414a3d',
            roof: '#454b4d', roof2: '#373d3f', wall: '#555d60', wall2: '#41484b',
            trim: '#1d2225', metal: '#727b7e', rust: '#7b4a30',
            fog: 'rgba(130, 145, 155, 0.13)', haze: 'rgba(140, 200, 220, 0.04)',
            night: '#02060a', accent: '#79c9d8', accent2: '#c9f4f5',
            lit: '#e8fff2', blood: '#511f1b', water: '#132126'
        }
    };

    // ============================================================ 武器 / 物资
    const WEAPONS = {
        pistol: {
            name: 'M1911', cn: '手枪', ammo: 'light', dmg: 30, rate: 0.31,
            mag: 12, reload: 1.12, spread: 0.022, pellets: 1, range: 760,
            speed: 1700, kick: 1.3, len: 24, auto: false, slot: 1
        },
        smg: {
            name: 'MP5', cn: '冲锋枪', ammo: 'light', dmg: 14, rate: 0.075,
            mag: 30, reload: 1.55, spread: 0.062, pellets: 1, range: 620,
            speed: 1900, kick: 0.55, len: 36, auto: true, slot: 2
        },
        shotgun: {
            name: 'M870', cn: '霰弹枪', ammo: 'shell', dmg: 13, rate: 0.84,
            mag: 6, reload: 2.15, spread: 0.20, pellets: 7, range: 440,
            speed: 1450, kick: 3.2, len: 44, auto: false, slot: 3
        },
        rifle: {
            name: 'M4A1', cn: '步枪', ammo: 'heavy', dmg: 44, rate: 0.39,
            mag: 10, reload: 1.65, spread: 0.012, pellets: 1, range: 980,
            speed: 2400, kick: 1.6, len: 50, auto: false, pierce: 2, slot: 4
        }
    };
    const WEAPON_ORDER = ['pistol', 'smg', 'shotgun', 'rifle'];

    const ITEM = {
        light: { name: '手枪弹', short: '9mm', color: '#e8edf3', glyph: '••' },
        shell: { name: '霰弹', short: '12G', color: '#ffb45c', glyph: '▮' },
        heavy: { name: '步枪弹', short: '5.56', color: '#b99aff', glyph: '▰' },
        medkit: { name: '医疗包', short: 'MED', color: '#ff7f9b', glyph: '+' },
        armor: { name: '护甲板', short: 'ARM', color: '#8fb6cc', glyph: '◆' },
        weapon: { name: '枪械', short: 'GUN', color: '#ffb35c', glyph: '⌐' }
    };

    const LOOT = {
        crate: {
            name: '补给箱', color: '#ffc46b', time: 1.15,
            table: [
                { item: 'light', min: 18, max: 34, weight: 36 },
                { item: 'shell', min: 6, max: 12, weight: 20 },
                { item: 'heavy', min: 5, max: 10, weight: 12 },
                { item: 'medkit', min: 1, max: 1, weight: 18 },
                { item: 'armor', min: 14, max: 26, weight: 14 }
            ]
        },
        military: {
            name: '军械箱', color: '#8dc4ff', time: 1.55,
            table: [
                { item: 'heavy', min: 14, max: 28, weight: 28 },
                { item: 'armor', min: 24, max: 42, weight: 24 },
                { item: 'medkit', min: 1, max: 2, weight: 14 },
                { item: 'light', min: 20, max: 40, weight: 16 },
                { item: 'weapon', min: 1, max: 1, weight: 18 }
            ]
        },
        med: {
            name: '医疗柜', color: '#ff91a9', time: 1.1,
            table: [
                { item: 'medkit', min: 1, max: 2, weight: 56 },
                { item: 'armor', min: 16, max: 30, weight: 26 },
                { item: 'light', min: 8, max: 16, weight: 18 }
            ]
        },
        trunk: {
            name: '后备箱', color: '#d6dde5', time: 0.95,
            table: [
                { item: 'light', min: 10, max: 24, weight: 34 },
                { item: 'shell', min: 4, max: 9, weight: 20 },
                { item: 'heavy', min: 4, max: 8, weight: 14 },
                { item: 'medkit', min: 1, max: 1, weight: 16 },
                { item: 'armor', min: 8, max: 18, weight: 16 }
            ]
        },
        gun: {
            name: '枪械箱', color: '#ffd27f', time: 1.55,
            table: [
                { item: 'weapon', min: 1, max: 1, weight: 1 }
            ]
        },
        duffel: {
            name: '行李袋', color: '#c8b184', time: 1.0,
            table: [
                { item: 'light', min: 14, max: 30, weight: 30 },
                { item: 'medkit', min: 1, max: 1, weight: 22 },
                { item: 'armor', min: 10, max: 22, weight: 20 },
                { item: 'shell', min: 4, max: 10, weight: 16 },
                { item: 'heavy', min: 3, max: 8, weight: 12 }
            ]
        }
    };

    const ZOMBIE = {
        walker: { name: '行尸', hp: 1, speed: 1, dmg: 1, r: 14, blood: '#4d1913', cloth: '#4e5a51' },
        runner: { name: '疾行者', hp: 0.55, speed: 1.9, dmg: 0.8, r: 12, blood: '#5a1a13', cloth: '#3e4a52' },
        brute: { name: '厚皮者', hp: 3.4, speed: 0.56, dmg: 2.2, r: 21, blood: '#431410', cloth: '#3d3a33' }
    };

    // ============================================================ 关卡数据
    // 坐标单位 = 世界像素。0 号车头朝右，rot=1 车头朝下。
    function carRow(x, y, n, gap, rot, kinds) {
        const list = [];
        for (let i = 0; i < n; i++) {
            list.push(['car', x + i * gap, y, rot || 0, kinds ? kinds[i % kinds.length] : 'sedan']);
        }
        return list;
    }

    const LEVELS = [
        // ------------------------------------------------------------ 1 废车坟场
        {
            key: 'junkyard', name: '废车坟场', en: 'SCRAPYARD', theme: 'rust',
            time: 75, w: 2800, h: 1900,
            spawn: [200, 1030], exit: [2570, 1030, 'truck'],
            brief: '锈蚀的车壳排成长廊，拆解车间的门还半开着。\n搜完这一片，趁天亮从东门撤出去。',
            goal: '搜刮 17 处物资 · 入夜后前往东侧救援车',
            zones: [
                ['dirt', 0, 0, 2800, 1900],
                ['road', 0, 900, 2800, 260, 'h'],
                ['dirt', 0, 40, 2800, 860],
                ['sidewalk', 0, 1160, 2800, 40],
                ['grass', 620, 120, 240, 180],
                ['grass', 2380, 1480, 360, 280]
            ],
            buildings: [
                { x: 60, y: 700, w: 230, h: 160, style: 'shed', sign: '门房', seed: 10 },
                { x: 150, y: 150, w: 430, h: 300, style: 'office', sign: '废车场管理处', seed: 11 },
                { x: 1870, y: 140, w: 650, h: 380, style: 'warehouse', sign: '拆解车间', seed: 12 }
            ],
            fences: [
                ['chain', 40, 40, 2720, 16],
                ['chain', 40, 40, 16, 1820],
                ['chain', 40, 1844, 2720, 16],
                ['chain', 2744, 40, 16, 840],
                ['chain', 2744, 1160, 16, 700],
                ['chain', 0, 872, 300, 12],
                ['chain', 520, 872, 470, 12]
            ],
            walls: [
                { x: 0, y: 1182, w: 420, h: 18, kind: 'concrete' },
                { x: 640, y: 1182, w: 760, h: 18, kind: 'concrete' }
            ],
            props: [
                ...carRow(240, 540, 6, 150, 0, ['sedan', 'burnt', 'suv', 'van', 'sedan', 'burnt']),
                ...carRow(340, 700, 5, 155, 0, ['suv', 'burnt', 'sedan', 'van', 'sedan']),
                ...carRow(1080, 400, 4, 170, 0, ['burnt', 'truck', 'sedan', 'suv']),
                ...carRow(1080, 580, 4, 170, 0, ['sedan', 'burnt', 'van', 'sedan']),
                ...carRow(210, 1360, 7, 165, 0, ['burnt', 'sedan', 'suv', 'burnt', 'van', 'sedan', 'burnt']),
                ...carRow(330, 1540, 6, 170, 0, ['sedan', 'burnt', 'suv', 'sedan', 'burnt', 'van']),
                ...carRow(1650, 1660, 4, 180, 0, ['burnt', 'sedan', 'suv', 'burnt']),
                ['car', 560, 1040, 0, 'burnt'],
                ['car', 900, 900, 0, 'sedan'],
                ['cube', 830, 760], ['cube', 900, 760], ['cube', 860, 820],
                ['barrier', 760, 1112, 200, 26],
                ['barrel', 680, 970, true], ['barrel', 735, 990, false],
                ['tires', 360, 1190, 4],
                ['dumpster', 120, 1190, 0], ['dumpster', 930, 1190, 0],
                ['tree', 110, 880, 26, true],
                ['billboard', 260, 830, 420],
                ['generator', 330, 760],
                ['crate', 820, 960, 30], ['crate', 820, 1010, 22],
                ['container', 900, 180, 300, 110, '#4f5b52'],
                ['container', 2120, 1420, 300, 110, '#5e5145'],
                ['cube', 1240, 690], ['cube', 1310, 690], ['cube', 1380, 690],
                ['cube', 1250, 760], ['cube', 1320, 760],
                ['crane', 1580, 690],
                ['tires', 780, 420, 5], ['tires', 700, 1470, 4], ['tires', 2260, 1600, 6],
                ['barrel', 620, 520, true], ['barrel', 690, 520, false], ['barrel', 1450, 1580, true],
                ['barrel', 1510, 1580, false], ['barrel', 2260, 900, false],
                ['dumpster', 980, 1280, 0], ['dumpster', 2450, 1440, 1],
                ['crate', 640, 500, 34], ['crate', 640, 445, 26], ['crate', 1880, 1290, 30],
                ['tree', 520, 1270, 26, true], ['tree', 2620, 1520, 30, true],
                ['tree', 1180, 150, 24, true], ['tree', 2320, 180, 24, true],
                ['generator', 2040, 620],
                ['barrier', 2100, 1000, 200, 26], ['barrier', 2400, 1000, 220, 26]
            ],
            lights: [
                { t: 'street', x: 360, y: 890, rot: 1 },
                { t: 'street', x: 1050, y: 890, rot: 1 },
                { t: 'fire', x: 680, y: 970, r: 120 },
                { t: 'street', x: 720, y: 890, rot: 1 },
                { t: 'street', x: 1480, y: 890, rot: 1 },
                { t: 'street', x: 2200, y: 890, rot: 1 },
                { t: 'fire', x: 1450, y: 1580, r: 150 },
                { t: 'fire', x: 620, y: 520, r: 95 }
            ],
            loot: [
                { t: 'gun', x: 300, y: 980 },
                { t: 'crate', x: 330, y: 1110 },
                { t: 'trunk', x: 560, y: 1100 },
                { t: 'crate', x: 600, y: 500 },
                { t: 'military', x: 1960, y: 610 },
                { t: 'med', x: 1030, y: 1450 },
                { t: 'trunk', x: 420, y: 595 },
                { t: 'trunk', x: 570, y: 595 },
                { t: 'trunk', x: 760, y: 755 },
                { t: 'trunk', x: 1170, y: 455 },
                { t: 'trunk', x: 1340, y: 455 },
                { t: 'crate', x: 1140, y: 720 },
                { t: 'military', x: 1600, y: 1610 },
                { t: 'duffel', x: 500, y: 1400 },
                { t: 'crate', x: 2200, y: 1460 },
                { t: 'crate', x: 2430, y: 1660 },
                { t: 'med', x: 2320, y: 570 }
            ],
            decals: [
                ['oil', 920, 1000, 90], ['oil', 1750, 1050, 70], ['oil', 1300, 700, 60],
                ['bones', 780, 620], ['bones', 1520, 1480], ['blood', 1360, 1050, 55]
            ]
        },

        // ------------------------------------------------------------ 2 塌陷立交
        {
            key: 'overpass', name: '塌陷立交', en: 'COLLAPSED BRIDGE', theme: 'overpass',
            time: 72, w: 3000, h: 2100,
            spawn: [110, 1660], exit: [2840, 1650, 'gate'],
            brief: '高架从城西塌到城东，桥墩下面成了唯一能走的路。\n两处桥洞可以穿到北边，军械箱就压在桥墩边。',
            goal: '搜刮 16 处物资 · 入夜后前往东侧闸门',
            zones: [
                ['concrete', 0, 0, 3000, 2100],
                ['road', 0, 1550, 3000, 200, 'h'],
                ['sidewalk', 0, 1460, 3000, 90],
                ['sidewalk', 0, 1750, 3000, 80],
                ['asphalt', 0, 610, 3000, 330],
                ['asphalt', 700, 880, 330, 670],
                ['asphalt', 1750, 880, 330, 670],
                ['dirt', 100, 120, 800, 380],
                ['dirt', 2600, 930, 300, 480]
            ],
            buildings: [
                { x: 120, y: 120, w: 520, h: 300, style: 'warehouse', seed: 21 },
                { x: 760, y: 130, w: 460, h: 280, style: 'office', sign: '公路养护段', seed: 22 },
                { x: 2250, y: 120, w: 580, h: 320, style: 'office', seed: 23 },
                { x: 280, y: 1840, w: 560, h: 200, style: 'warehouse', seed: 24 },
                { x: 1120, y: 1860, w: 420, h: 180, style: 'house', seed: 25 },
                { x: 2260, y: 1840, w: 500, h: 200, style: 'warehouse', seed: 26 }
            ],
            walls: [
                { x: 120, y: 470, w: 900, h: 22, kind: 'concrete' },
                { x: 120, y: 470, w: 22, h: 200, kind: 'concrete' }
            ],
            structures: [
                { t: 'deck', x: 0, y: 560, w: 700, h: 360, collapse: 0 },
                { t: 'deck', x: 1030, y: 560, w: 720, h: 360, collapse: 1 },
                { t: 'deck', x: 2080, y: 560, w: 920, h: 360, collapse: 0 }
            ],
            fences: [
                ['chain', 2700, 960, 16, 430],
                ['chain', 40, 1940, 2920, 14]
            ],
            props: [
                ...carRow(240, 1620, 5, 170, 0, ['burnt', 'sedan', 'van', 'burnt', 'suv']),
                ...carRow(1180, 1620, 4, 180, 0, ['sedan', 'burnt', 'truck', 'sedan']),
                ...carRow(2180, 1620, 4, 180, 0, ['burnt', 'suv', 'sedan', 'burnt']),
                ...carRow(880, 1080, 3, 160, 0, ['burnt', 'van', 'sedan']),
                ...carRow(1900, 1080, 3, 160, 0, ['sedan', 'burnt', 'suv']),
                ['column', 700, 560, 90, 90], ['column', 700, 830, 90, 90],
                ['column', 1030, 560, 90, 90], ['column', 1030, 830, 90, 90],
                ['column', 1750, 560, 90, 90], ['column', 1750, 830, 90, 90],
                ['column', 2080, 560, 90, 90], ['column', 2080, 830, 90, 90],
                ['column', 1500, 760, 80, 80],
                ['column', 380, 946, 64, 64], ['column', 940, 946, 64, 64],
                ['column', 1580, 946, 64, 64], ['column', 2300, 946, 64, 64],
                ['rubble', 1250, 640, 150], ['rubble', 1450, 690, 120], ['rubble', 2600, 700, 110],
                ['rubble', 960, 1300, 90], ['rubble', 2320, 1260, 110],
                ['barrier', 1230, 620, 380, 24], ['barrier', 1250, 820, 300, 24],
                ['barrel', 760, 700, true], ['barrel', 810, 720, false], ['barrel', 2200, 1000, true],
                ['bus', 850, 1700, 0, 'burnt'],
                ['truck', 2550, 1680, 0, 'burnt'],
                ['dumpster', 640, 1260, 0], ['dumpster', 2420, 1000, 1],
                ['crate', 780, 960, 30], ['crate', 780, 905, 24],
                ['tree', 420, 1340, 26, true], ['tree', 2720, 1400, 30, true],
                ['tires', 2460, 1360, 5], ['tires', 980, 640, 4],
                ['generator', 2250, 630],
                ['billboard', 2460, 350, 420]
            ],
            lights: [
                { t: 'street', x: 520, y: 1540, rot: 1 },
                { t: 'street', x: 1430, y: 1540, rot: 1 },
                { t: 'street', x: 2340, y: 1540, rot: 1 },
                { t: 'fluoro', x: 860, y: 760, w: 180, h: 18, rot: 1 },
                { t: 'fluoro', x: 1910, y: 760, w: 180, h: 18, rot: 1 },
                { t: 'fire', x: 760, y: 700, r: 130 },
                { t: 'fire', x: 2200, y: 1000, r: 120 }
            ],
            loot: [
                { t: 'gun', x: 110, y: 1580 },
                { t: 'crate', x: 900, y: 1320 },
                { t: 'military', x: 1160, y: 1120 },
                { t: 'military', x: 2170, y: 1120 },
                { t: 'crate', x: 770, y: 1010 },
                { t: 'med', x: 1320, y: 700 },
                { t: 'trunk', x: 330, y: 1675 },
                { t: 'trunk', x: 500, y: 1675 },
                { t: 'trunk', x: 1270, y: 1675 },
                { t: 'trunk', x: 2270, y: 1675 },
                { t: 'duffel', x: 980, y: 1710 },
                { t: 'crate', x: 2350, y: 1010 },
                { t: 'crate', x: 1950, y: 1120 },
                { t: 'med', x: 2820, y: 1150 },
                { t: 'crate', x: 640, y: 1870 },
                { t: 'crate', x: 2870, y: 800 }
            ],
            decals: [
                ['oil', 900, 1600, 80], ['oil', 1900, 1550, 90], ['oil', 1400, 1000, 70],
                ['crack', 1120, 1380, 180], ['crack', 2400, 1300, 160],
                ['blood', 1200, 1200, 48], ['bones', 1980, 980]
            ]
        },

        // ------------------------------------------------------------ 3 商业街残骸
        {
            key: 'commercial', name: '商业街残骸', en: 'NEON STREET', theme: 'neon',
            time: 70, w: 3000, h: 2000,
            spawn: [160, 1050], exit: [2830, 1050, 'bus'],
            brief: '整条街只剩霓虹还亮着。卷帘门半开，雨把招牌的倒影拉得很长。\n药房、当铺、面馆 —— 能翻的都翻一遍。',
            goal: '搜刮 17 处物资 · 入夜后登上东侧装甲巴士',
            zones: [
                ['asphalt', 0, 0, 3000, 2000],
                ['road', 0, 850, 3000, 400, 'h'],
                ['sidewalk', 0, 760, 3000, 90],
                ['sidewalk', 0, 1250, 3000, 90],
                ['concrete', 1380, 880, 380, 340],
                ['grass', 2620, 160, 260, 260]
            ],
            buildings: [
                { x: 100, y: 300, w: 440, h: 460, style: 'shop', sign: '仁和药房', hue: '#3f7d78', seed: 31 },
                { x: 560, y: 340, w: 380, h: 420, style: 'shop', sign: '当铺', hue: '#6a4c72', seed: 32 },
                { x: 960, y: 280, w: 430, h: 480, style: 'shop', sign: '老陈面馆', hue: '#7a4438', seed: 33 },
                { x: 1700, y: 320, w: 430, h: 440, style: 'shop', sign: '旅社', hue: '#405a70', seed: 34 },
                { x: 2150, y: 280, w: 380, h: 480, style: 'shop', sign: '电器行', hue: '#5c5540', seed: 35 },
                { x: 2550, y: 340, w: 340, h: 420, style: 'shop', sign: '钟表店', hue: '#4a5c50', seed: 36 },
                { x: 120, y: 1340, w: 480, h: 440, style: 'shop', sign: '录像厅', hue: '#5d4052', seed: 37 },
                { x: 620, y: 1380, w: 400, h: 400, style: 'shop', sign: '五金', hue: '#4c5540', seed: 38 },
                { x: 1300, y: 1340, w: 460, h: 440, style: 'shop', sign: '百货', hue: '#4f586b', seed: 39 },
                { x: 1790, y: 1380, w: 420, h: 400, style: 'shop', sign: '酒吧', hue: '#6e3b44', seed: 40 },
                { x: 2230, y: 1340, w: 470, h: 440, style: 'shop', sign: '书店', hue: '#4a5140', seed: 41 }
            ],
            props: [
                ...carRow(260, 800, 4, 210, 0, ['sedan', 'taxi', 'suv', 'burnt']),
                ...carRow(1720, 800, 3, 220, 0, ['van', 'sedan', 'burnt']),
                ...carRow(250, 1300, 3, 230, 0, ['burnt', 'suv', 'sedan']),
                ...carRow(1120, 1300, 3, 220, 0, ['taxi', 'burnt', 'sedan']),
                ['bus', 2350, 1300, 0, 'burnt'],
                ['fountain', 1560, 1050, 82],
                ['bench', 1390, 960, 0], ['bench', 1720, 960, 0],
                ['bench', 1390, 1130, 0], ['bench', 1720, 1130, 0],
                ['planter', 1320, 900, 26], ['planter', 1800, 900, 26],
                ['planter', 1320, 1190, 26], ['planter', 1800, 1190, 26],
                ['dumpster', 600, 780, 0], ['dumpster', 2170, 780, 1],
                ['dumpster', 680, 1320, 0], ['dumpster', 2740, 1280, 1],
                ['cart', 870, 1180], ['cart', 1900, 1210], ['cart', 2760, 980],
                ['barrel', 980, 1320, false], ['barrel', 2100, 1320, true],
                ['crate', 640, 1290, 28], ['crate', 1130, 760, 32], ['crate', 1130, 820, 22],
                ['tree', 2680, 260, 26, true],
                ['vending', 2140, 800, 0], ['vending', 880, 1320, 1],
                ['phone', 1030, 1300],
                ['tires', 1300, 1750, 3]
            ],
            lights: [
                { t: 'street', x: 720, y: 830, rot: 1 },
                { t: 'street', x: 1600, y: 830, rot: 1 },
                { t: 'street', x: 2440, y: 830, rot: 1 },
                { t: 'street', x: 1120, y: 1290, rot: -1 },
                { t: 'street', x: 2020, y: 1290, rot: -1 },
                { t: 'sign', x: 320, y: 600, color: '#74f5d8', w: 260 },
                { t: 'sign', x: 1175, y: 610, color: '#ff6b6b', w: 250 },
                { t: 'sign', x: 1915, y: 620, color: '#ffd27a', w: 220 },
                { t: 'sign', x: 2580, y: 620, color: '#a99bff', w: 210 },
                { t: 'sign', x: 1380, y: 1440, color: '#ff5f8f', w: 250 },
                { t: 'sign', x: 2300, y: 1440, color: '#8fe6ff', w: 220 }
            ],
            loot: [
                { t: 'gun', x: 300, y: 1000 },
                { t: 'crate', x: 600, y: 720 },
                { t: 'med', x: 560, y: 930 },
                { t: 'military', x: 700, y: 1050 },
                { t: 'trunk', x: 300, y: 860 },
                { t: 'trunk', x: 510, y: 860 },
                { t: 'trunk', x: 1750, y: 860 },
                { t: 'trunk', x: 1260, y: 1360 },
                { t: 'trunk', x: 2350, y: 1660 },
                { t: 'duffel', x: 1430, y: 1050 },
                { t: 'crate', x: 1850, y: 1300 },
                { t: 'med', x: 2790, y: 1420 },
                { t: 'crate', x: 2680, y: 900 },
                { t: 'military', x: 2840, y: 760 },
                { t: 'duffel', x: 900, y: 1690 },
                { t: 'crate', x: 2050, y: 900 },
                { t: 'crate', x: 1200, y: 1050 }
            ],
            decals: [
                ['puddle', 800, 1000, 90], ['puddle', 1300, 1150, 70], ['puddle', 2200, 980, 110],
                ['puddle', 2650, 1180, 75], ['puddle', 520, 1180, 60], ['puddle', 1800, 1100, 85],
                ['blood', 1500, 1200, 40], ['paper', 1000, 1150], ['paper', 2050, 950]
            ]
        },

        // ------------------------------------------------------------ 4 地铁深处
        {
            key: 'subway', name: '地铁深处', en: 'DEEP LINE', theme: 'subway',
            time: 68, w: 3200, h: 2000,
            spawn: [170, 1000], exit: [3030, 1000, 'stairs'],
            brief: '站厅的灯只剩三分之一还亮着，轨道下面在滴水。\n穿过停运的列车和检票口，从东端检修通道上去。',
            goal: '搜刮 16 处物资 · 入夜后前往东端检修通道',
            zones: [
                ['tile', 80, 80, 3040, 1840],
                ['platform', 80, 620, 3040, 760],
                ['tracks', 80, 240, 3040, 380],
                ['tracks', 80, 1380, 3040, 380],
                ['tile', 2290, 120, 760, 240]
            ],
            walls: [
                { x: 0, y: 0, w: 3200, h: 80, kind: 'concrete' },
                { x: 0, y: 1920, w: 3200, h: 80, kind: 'concrete' },
                { x: 0, y: 0, w: 80, h: 2000, kind: 'concrete' },
                { x: 3120, y: 0, w: 80, h: 2000, kind: 'concrete' },
                { x: 80, y: 232, w: 3040, h: 8, kind: 'tile' },
                { x: 80, y: 1360, w: 3040, h: 8, kind: 'tile' },
                { x: 2290, y: 80, w: 16, h: 300, kind: 'tile' },
                { x: 2290, y: 360, w: 360, h: 16, kind: 'tile' },
                { x: 2760, y: 360, w: 360, h: 16, kind: 'tile' },
                { x: 3050, y: 80, w: 16, h: 300, kind: 'tile' }
            ],
            props: [
                ['train', 360, 300, 960, 290, 'parked'],
                ['train', 1480, 1520, 1120, 300, 'derailed'],
                ['ticketgate', 640, 760, 0], ['ticketgate', 640, 900, 0],
                ['ticketgate', 640, 1040, 0], ['ticketgate', 640, 1180, 0],
                ['pillar', 900, 700, 46, 46], ['pillar', 900, 1000, 46, 46],
                ['pillar', 1200, 700, 46, 46], ['pillar', 1200, 1000, 46, 46],
                ['pillar', 1500, 700, 46, 46], ['pillar', 1500, 1000, 46, 46],
                ['pillar', 1800, 700, 46, 46], ['pillar', 1800, 1000, 46, 46],
                ['pillar', 2100, 700, 46, 46], ['pillar', 2100, 1000, 46, 46],
                ['pillar', 2400, 700, 46, 46], ['pillar', 2400, 1000, 46, 46],
                ['pillar', 2700, 700, 46, 46], ['pillar', 2700, 1000, 46, 46],
                ['bench', 1050, 560, 0], ['bench', 1350, 560, 0], ['bench', 1650, 560, 0],
                ['bench', 1050, 1280, 0], ['bench', 1350, 1280, 0],
                ['vending', 2250, 560, 0], ['vending', 2250, 1280, 1],
                ['crate', 2340, 210, 30], ['crate', 2410, 210, 24],
                ['trash', 760, 1300], ['trash', 1900, 1240], ['trash', 2860, 800],
                ['barrel', 1050, 900, true], ['barrel', 1100, 930, false],
                ['barrier', 2800, 1050, 200, 26],
                ['column', 620, 640, 60, 60], ['column', 620, 1320, 60, 60],
                ['watertank', 2860, 160, 46],
                ['subwaysign', 1240, 850, 340, '04 号线 · 废土站'],
                ['subwaysign', 2360, 1180, 300, '东端检修通道 →']
            ],
            lights: [
                { t: 'tube', x: 420, y: 800, w: 160, rot: 0 },
                { t: 'tube', x: 900, y: 1100, w: 160, rot: 0 },
                { t: 'tube', x: 1400, y: 800, w: 160, rot: 0 },
                { t: 'tube', x: 1900, y: 1100, w: 160, rot: 0 },
                { t: 'tube', x: 2400, y: 800, w: 160, rot: 0 },
                { t: 'tube', x: 2800, y: 1150, w: 120, rot: 0 },
                { t: 'sign', x: 3000, y: 1000, color: '#ff5b4a', w: 80, vertical: true },
                { t: 'fire', x: 1050, y: 900, r: 100 }
            ],
            loot: [
                { t: 'gun', x: 300, y: 1000 },
                { t: 'duffel', x: 520, y: 830 },
                { t: 'crate', x: 940, y: 1180 },
                { t: 'trunk', x: 1250, y: 620 },
                { t: 'military', x: 2380, y: 220 },
                { t: 'med', x: 2320, y: 180 },
                { t: 'duffel', x: 1530, y: 1250 },
                { t: 'crate', x: 1850, y: 1400 },
                { t: 'military', x: 2800, y: 800 },
                { t: 'med', x: 2950, y: 900 },
                { t: 'crate', x: 860, y: 1480 },
                { t: 'crate', x: 2600, y: 1300 },
                { t: 'duffel', x: 1960, y: 580 },
                { t: 'trunk', x: 700, y: 1120 },
                { t: 'crate', x: 1430, y: 960 },
                { t: 'military', x: 2960, y: 480 }
            ],
            decals: [
                ['puddle', 900, 1150, 85], ['puddle', 1700, 1000, 110], ['puddle', 2550, 1200, 80],
                ['blood', 1150, 1080, 50], ['blood', 2100, 900, 45], ['paper', 1500, 1200],
                ['paper', 1900, 700], ['crack', 2300, 1450, 200]
            ]
        },

        // ------------------------------------------------------------ 5 加油站
        {
            key: 'gas', name: '燃油余烬', en: 'LAST FUEL', theme: 'fire',
            time: 65, w: 2600, h: 1800,
            spawn: [140, 1325], exit: [2410, 1325, 'truck'],
            brief: '油罐车烧了整夜，火光照着「最后一座加油站」的牌子。\n便利店里也许还有药，泵岛下面藏着修车工具和弹药。',
            goal: '搜刮 15 处物资 · 入夜后前往东侧救援车',
            zones: [
                ['asphalt', 0, 0, 2600, 1800],
                ['road', 0, 1200, 2600, 250, 'h'],
                ['sidewalk', 0, 1140, 2600, 60],
                ['sidewalk', 0, 1450, 2600, 60],
                ['concrete', 180, 280, 2220, 860],
                ['dirt', 2300, 300, 260, 300]
            ],
            buildings: [
                { x: 1900, y: 380, w: 480, h: 380, style: 'station', sign: '最后一座加油站', seed: 51 },
                { x: 320, y: 250, w: 260, h: 180, style: 'shed', seed: 52 }
            ],
            fences: [
                ['chain', 20, 40, 2560, 14],
                ['chain', 20, 40, 14, 1080],
                ['chain', 20, 1120, 14, 640],
                ['razor', 2360, 40, 14, 300]
            ],
            props: [
                ['tanker', 350, 730, 1, 'burning'],
                ['canopy', 760, 540, 820, 420],
                ['pump', 990, 750], ['pump', 1230, 750], ['pump', 1470, 750],
                ['column', 800, 580, 26, 26], ['column', 1540, 580, 26, 26],
                ['column', 800, 920, 26, 26], ['column', 1540, 920, 26, 26],
                ['tank', 1750, 390, 54], ['tank', 1750, 530, 54],
                ['barrier', 1940, 800, 380, 24],
                ...carRow(450, 1050, 4, 170, 0, ['burnt', 'sedan', 'van', 'burnt']),
                ...carRow(820, 1580, 4, 200, 0, ['sedan', 'burnt', 'suv', 'sedan']),
                ...carRow(1880, 1580, 2, 210, 0, ['burnt', 'suv']),
                ['dumpster', 1730, 1050, 0], ['dumpster', 2240, 820, 1],
                ['barrel', 650, 920, true], ['barrel', 700, 940, false], ['barrel', 1650, 1000, true],
                ['tires', 900, 350, 4], ['tires', 460, 880, 3], ['tires', 2180, 1050, 5],
                ['crate', 640, 620, 32], ['crate', 640, 680, 24], ['crate', 2170, 720, 30],
                ['tree', 2400, 700, 26, true], ['tree', 420, 1120, 24, true],
                ['vending', 1870, 820, 0],
                ['cart', 1800, 980],
                ['generator', 2160, 1000],
                ['pylon', 620, 1090], ['pylon', 1700, 980],
                ['bollard', 930, 660], ['bollard', 1180, 660], ['bollard', 1430, 660],
                ['bollard', 930, 850], ['bollard', 1180, 850], ['bollard', 1430, 850],
                ['billboard', 1500, 300, 460]
            ],
            lights: [
                { t: 'street', x: 700, y: 1180, rot: 1 },
                { t: 'street', x: 1600, y: 1180, rot: 1 },
                { t: 'street', x: 2280, y: 1180, rot: 1 },
                { t: 'canopy', x: 760, y: 540, w: 820, h: 420 },
                { t: 'fire', x: 350, y: 730, r: 210 },
                { t: 'fire', x: 650, y: 920, r: 110 },
                { t: 'fire', x: 1650, y: 1000, r: 95 }
            ],
            loot: [
                { t: 'gun', x: 300, y: 1325 },
                { t: 'crate', x: 640, y: 620 },
                { t: 'military', x: 860, y: 1000 },
                { t: 'med', x: 2070, y: 840 },
                { t: 'trunk', x: 520, y: 1115 },
                { t: 'trunk', x: 1180, y: 1115 },
                { t: 'trunk', x: 900, y: 1640 },
                { t: 'trunk', x: 1500, y: 1640 },
                { t: 'crate', x: 1300, y: 900 },
                { t: 'med', x: 1740, y: 620 },
                { t: 'crate', x: 1980, y: 900 },
                { t: 'military', x: 2260, y: 900 },
                { t: 'duffel', x: 2400, y: 620 },
                { t: 'crate', x: 2040, y: 1640 },
                { t: 'duffel', x: 2100, y: 420 }
            ],
            decals: [
                ['oil', 1000, 860, 110], ['oil', 1500, 900, 90], ['oil', 400, 1100, 80],
                ['blood', 1200, 1000, 52], ['bones', 1800, 1100], ['crack', 900, 1300, 160],
                ['puddle', 600, 1000, 60]
            ]
        },

        // ------------------------------------------------------------ 6 冷雨隔离区
        {
            key: 'quarantine', name: '冷雨隔离区', en: 'QUARANTINE', theme: 'quarantine',
            time: 62, w: 3000, h: 2100,
            spawn: [220, 1820], exit: [2680, 370, 'heli'],
            brief: '铁丝网把最后一批人关在这里，雨一直没停。\n穿过集装箱迷宫，从岗哨旁的直升机坪离开。',
            goal: '搜刮 17 处物资 · 入夜后登上东北角直升机',
            zones: [
                ['concrete', 0, 0, 3000, 2100],
                ['road', 0, 1720, 2300, 200, 'h'],
                ['road', 2080, 540, 220, 1180, 'v'],
                ['helipad', 2420, 160, 520, 520],
                ['dirt', 100, 100, 700, 600],
                ['dirt', 900, 1400, 600, 280]
            ],
            fences: [
                ['razor', 40, 40, 2920, 14],
                ['razor', 40, 40, 14, 2020],
                ['razor', 40, 2044, 2920, 14],
                ['razor', 2944, 40, 14, 2020],
                ['razor', 2180, 820, 14, 220],
                ['razor', 2180, 1180, 14, 380],
                ['razor', 2180, 1560, 300, 14],
                ['razor', 1480, 600, 360, 14],
                ['razor', 1480, 600, 14, 300],
                ['razor', 820, 960, 420, 14]
            ],
            buildings: [
                { x: 1250, y: 640, w: 500, h: 320, style: 'tent', sign: '联合指挥所', hue: '#4f5d4c', seed: 61 },
                { x: 900, y: 1080, w: 340, h: 240, style: 'tent', sign: '野战医疗', hue: '#6a5a50', seed: 62 },
                { x: 2280, y: 620, w: 200, h: 170, style: 'booth', sign: '检查站', seed: 63 },
                { x: 1730, y: 900, w: 300, h: 210, style: 'tent', hue: '#4d555c', seed: 64 }
            ],
            props: [
                ['container', 420, 1500, 300, 110, '#4b5a58'],
                ['container', 790, 1500, 300, 110, '#5d5546'],
                ['container', 380, 1180, 110, 280, '#4c5560'],
                ['container', 560, 900, 260, 110, '#5c4d44'],
                ['container', 900, 700, 110, 260, '#485a50'],
                ['container', 1550, 1480, 300, 110, '#555a4c'],
                ['container', 1600, 1180, 110, 260, '#5a4e47'],
                ['container', 1910, 1480, 280, 110, '#4d5259'],
                ['container', 2380, 1420, 300, 110, '#565b4f'],
                ['container', 2380, 1080, 110, 280, '#5c554a'],
                ['tent', 1680, 300, 280, 200, '#4d584e'],
                ['tent', 1060, 300, 240, 180, '#5a5148'],
                ['watchtower', 500, 300], ['watchtower', 1900, 250], ['watchtower', 2350, 760],
                ['humvee', 1500, 1750, 0, 'burnt'],
                ['humvee', 2670, 1250, 1, 'olive'],
                ['sandbag', 2100, 980, 260, 44], ['sandbag', 2300, 900, 160, 40],
                ['barrier', 2450, 920, 220, 26], ['barrier', 2500, 1180, 240, 26],
                ['barrel', 1950, 900, true], ['barrel', 2000, 920, false],
                ['crate', 1420, 1750, 30], ['crate', 1480, 1750, 24],
                ['crate', 2200, 1400, 28], ['crate', 2800, 900, 30],
                ['tires', 2330, 1700, 4], ['tree', 260, 800, 26, true],
                ['generator', 2140, 1600],
                ['vending', 2210, 1080, 1],
                ['windsock', 2860, 290],
                ['barrel', 2460, 260, false], ['barrel', 2515, 270, false],
                ['crate', 2380, 640, 30], ['crate', 2440, 650, 24],
                ['sandbag', 2330, 380, 180, 44],
                ['billboard', 1200, 80, 420]
            ],
            lights: [
                { t: 'flood', x: 2560, y: 320, r: 300 },
                { t: 'flood', x: 2790, y: 620, r: 260 },
                { t: 'flood', x: 2240, y: 900, r: 220 },
                { t: 'street', x: 1400, y: 1700, rot: -1 },
                { t: 'street', x: 600, y: 1700, rot: -1 },
                { t: 'fire', x: 1950, y: 900, r: 110 },
                { t: 'searchlight', x: 1900, y: 250, r: 380 },
                { t: 'searchlight', x: 500, y: 300, r: 340 }
            ],
            loot: [
                { t: 'gun', x: 380, y: 1820 },
                { t: 'military', x: 1320, y: 900 },
                { t: 'med', x: 980, y: 1200 },
                { t: 'crate', x: 700, y: 1660 },
                { t: 'crate', x: 1180, y: 1660 },
                { t: 'duffel', x: 470, y: 1440 },
                { t: 'military', x: 760, y: 1420 },
                { t: 'crate', x: 630, y: 960 },
                { t: 'med', x: 1720, y: 1120 },
                { t: 'duffel', x: 1980, y: 1350 },
                { t: 'crate', x: 2450, y: 1600 },
                { t: 'military', x: 2650, y: 1150 },
                { t: 'crate', x: 2760, y: 980 },
                { t: 'crate', x: 1650, y: 380 },
                { t: 'med', x: 1120, y: 380 },
                { t: 'duffel', x: 1450, y: 1720 },
                { t: 'military', x: 2890, y: 760 }
            ],
            decals: [
                ['puddle', 1100, 1550, 100], ['puddle', 2000, 1300, 85], ['puddle', 2600, 1000, 90],
                ['puddle', 2450, 830, 110], ['puddle', 2720, 930, 80], ['puddle', 2260, 1240, 120],
                ['blood', 900, 1330, 55], ['blood', 1500, 1550, 60], ['paper', 2200, 1500],
                ['bones', 1380, 1180], ['crack', 2000, 800, 200]
            ]
        }
    ];

    // ============================================================ 工具函数
    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function rndInt(a, b) { return Math.floor(rnd(a, b + 1)); }
    function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
    function dist(ax, ay, bx, by) { const dx = ax - bx; const dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
    function angleDiff(a, b) {
        let d = (a - b) % TAU;
        if (d > Math.PI) { d -= TAU; }
        if (d < -Math.PI) { d += TAU; }
        return d;
    }
    function easeOut(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }
    function eucMod(v, m) { return ((v % m) + m) % m; }

    function hexToRgb(hex) {
        let h = String(hex).replace('#', '');
        if (h.length === 3) { h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; }
        const n = parseInt(h, 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    function rgba(hex, a) {
        const c = hexToRgb(hex);
        return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
    }
    function shade(hex, amt) {
        const c = hexToRgb(hex);
        let r, g, b;
        if (amt >= 0) {
            r = c.r + (255 - c.r) * amt;
            g = c.g + (255 - c.g) * amt;
            b = c.b + (255 - c.b) * amt;
        } else {
            r = c.r * (1 + amt); g = c.g * (1 + amt); b = c.b * (1 + amt);
        }
        return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
    }
    function mixHex(a, b, t) {
        const ca = hexToRgb(a), cb = hexToRgb(b);
        const r = Math.round(lerp(ca.r, cb.r, t));
        const g = Math.round(lerp(ca.g, cb.g, t));
        const bl = Math.round(lerp(ca.b, cb.b, t));
        return 'rgb(' + r + ',' + g + ',' + bl + ')';
    }

    function lightenHex(hex, amt) {
        const c = hexToRgb(hex);
        const lift = (v) => Math.round(v + (255 - v) * amt);
        return '#' + [lift(c.r), lift(c.g), lift(c.b)].map((v) => clamp(v, 0, 255).toString(16).padStart(2, '0')).join('');
    }

    // 日间曝光整体抬一档：俯视场景的大部分面积是地面，颜色压得太暗会糊成一片。
    // 只抬环境色，不动夜色和霓虹强调色。
    (function liftThemeColors() {
        const lift = { rust: 0.16, overpass: 0.075, neon: 0.09, subway: 0.035, fire: 0.13, quarantine: 0.02 };
        const keys = ['base', 'baseDark', 'baseLight', 'asphalt', 'asphalt2', 'concrete', 'concrete2', 'curb', 'dirt', 'dirt2', 'grass', 'roof', 'roof2', 'wall', 'wall2', 'metal'];
        for (const name in THEMES) {
            const t = THEMES[name];
            const amt = lift[name] || 0;
            if (!amt) { continue; }
            for (const k of keys) {
                if (typeof t[k] === 'string' && t[k].charAt(0) === '#') {
                    t[k] = lightenHex(t[k], amt);
                }
            }
        }
    })();

    function seeded(seed) {
        let s = (seed >>> 0) || 1;
        return function () {
            s ^= s << 13; s >>>= 0;
            s ^= s >> 17;
            s ^= s << 5; s >>>= 0;
            return s / 4294967295;
        };
    }

    function weightPick(table) {
        let total = 0;
        for (const entry of table) { total += entry.weight; }
        let roll = Math.random() * total;
        for (const entry of table) {
            roll -= entry.weight;
            if (roll <= 0) { return entry; }
        }
        return table[table.length - 1];
    }

    function roundRect(g, x, y, w, h, r) {
        const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
        g.beginPath();
        g.moveTo(x + rr, y);
        g.arcTo(x + w, y, x + w, y + h, rr);
        g.arcTo(x + w, y + h, x, y + h, rr);
        g.arcTo(x, y + h, x, y, rr);
        g.arcTo(x, y, x + w, y, rr);
        g.closePath();
    }

    function circleRect(cx, cy, r, rect) {
        const nx = clamp(cx, rect.x, rect.x + rect.w);
        const ny = clamp(cy, rect.y, rect.y + rect.h);
        const dx = cx - nx, dy = cy - ny;
        return dx * dx + dy * dy < r * r;
    }

    // ============================================================ 音频
    const audio = {
        ctx: null, master: null, noise: null, muted: false,
        drone: null, droneGain: null, wind: null, windGain: null
    };

    function initAudio() {
        if (audio.ctx) {
            if (audio.ctx.state === 'suspended') { audio.ctx.resume(); }
            return;
        }
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) { return; }
        audio.ctx = new Ctx();
        audio.master = audio.ctx.createGain();
        audio.master.gain.value = audio.muted ? 0 : 0.42;
        audio.master.connect(audio.ctx.destination);

        const len = Math.floor(audio.ctx.sampleRate * 1.6);
        const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) { data[i] = Math.random() * 2 - 1; }
        audio.noise = buf;
    }

    function soundNoise(opts) {
        if (!audio.ctx || audio.muted) { return; }
        const ctx = audio.ctx;
        const now = ctx.currentTime;
        const dur = opts.dur || 0.2;
        const src = ctx.createBufferSource();
        src.buffer = audio.noise;
        src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = opts.filter || 'lowpass';
        filter.frequency.setValueAtTime(opts.freq || 1200, now);
        if (opts.sweep) {
            filter.frequency.exponentialRampToValueAtTime(Math.max(40, opts.sweep), now + dur);
        }
        filter.Q.value = opts.q || 1;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(opts.gain || 0.4, now + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        src.connect(filter).connect(gain).connect(audio.master);
        src.start(now);
        src.stop(now + dur + 0.03);
    }

    function soundTone(opts) {
        if (!audio.ctx || audio.muted) { return; }
        const ctx = audio.ctx;
        const now = ctx.currentTime;
        const dur = opts.dur || 0.2;
        const osc = ctx.createOscillator();
        osc.type = opts.type || 'sine';
        osc.frequency.setValueAtTime(opts.freq, now);
        if (opts.to) { osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), now + dur); }
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(opts.gain || 0.2, now + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        let node = osc;
        if (opts.filter) {
            const f = ctx.createBiquadFilter();
            f.type = opts.filter.type || 'lowpass';
            f.frequency.value = opts.filter.freq || 800;
            osc.connect(f);
            node = f;
        }
        node.connect(gain).connect(audio.master);
        osc.start(now);
        osc.stop(now + dur + 0.03);
    }

    function vary(v, pct) { return v * rnd(1 - pct, 1 + pct); }

    const lastFired = {};
    function dedupe(key, gain) {
        const now = performance.now();
        if (lastFired[key] !== undefined && now - lastFired[key] < 55) { return gain * 0.55; }
        lastFired[key] = now;
        return gain;
    }

    function gunshot(key, o) {
        soundNoise({
            dur: vary(o.dur, 0.06),
            freq: vary(o.freq, 0.05),
            sweep: vary(o.sweep || 300, 0.08),
            gain: vary(dedupe(key, o.gain), 0.12)
        });
        if (o.tone) {
            soundTone({
                freq: vary(o.tone[0], 0.05), to: o.tone[1], dur: o.tone[2],
                gain: vary(o.tone[3], 0.12), type: o.tone[4] || 'sine'
            });
        }
    }

    const SFX = {
        pistol: () => gunshot('pistol', { dur: 0.16, freq: 2500, sweep: 360, gain: 0.45, tone: [150, 70, 0.1, 0.12] }),
        smg: () => gunshot('smg', { dur: 0.09, freq: 3000, sweep: 700, gain: 0.3 }),
        shotgun: () => {
            gunshot('shotgun', { dur: 0.34, freq: 1400, sweep: 160, gain: 0.6, tone: [112, 52, 0.28, 0.3] });
            window.setTimeout(() => soundNoise({ dur: 0.14, freq: 820, sweep: 220, gain: 0.14 }), rnd(0, 40));
        },
        rifle: () => gunshot('rifle', { dur: 0.2, freq: 3200, sweep: 480, gain: 0.5, tone: [190, 78, 0.14, 0.18, 'square'] }),
        knife: () => soundNoise({ dur: 0.14, freq: 1800, sweep: 500, gain: 0.18, filter: 'highpass' }),
        knifeHit: () => {
            soundNoise({ dur: 0.16, freq: 700, sweep: 160, gain: 0.34 });
            soundTone({ freq: 110, to: 58, dur: 0.14, gain: 0.18, type: 'triangle' });
        },
        step: (heavy, foot) => soundNoise({
            dur: 0.055, freq: vary(heavy ? 250 : 310, 0.1) * (foot ? 1.07 : 0.93),
            gain: dedupe('step', heavy ? 0.1 : 0.055), filter: 'highpass', q: 0.7
        }),
        dryFire: () => soundNoise({ dur: 0.035, freq: 2300, gain: dedupe('dry', 0.14), filter: 'highpass' }),
        wallHit: () => {
            soundNoise({ dur: 0.055, freq: vary(1700, 0.12), sweep: 520, gain: dedupe('wall', 0.14) });
            if (Math.random() < 0.28) {
                soundTone({ freq: vary(1300, 0.25), to: 2200, dur: 0.09, gain: 0.07, type: 'triangle' });
            }
        },
        flesh: () => {
            soundNoise({ dur: 0.1, freq: vary(520, 0.15), sweep: 160, gain: dedupe('flesh', 0.26) });
        },
        zombieBite: () => {
            soundNoise({ dur: 0.2, freq: 560, sweep: 170, gain: dedupe('bite', 0.4) });
            soundTone({ freq: 88, to: 58, dur: 0.22, gain: 0.24, type: 'sawtooth', filter: { freq: 360 } });
        },
        zombieDown: (kind) => {
            const low = kind === 'brute';
            soundNoise({ dur: low ? 0.4 : 0.28, freq: low ? 190 : 240, sweep: 90, gain: dedupe('zdown', 0.3) });
            soundTone({ freq: low ? 64 : 92, to: 44, dur: 0.26, gain: 0.17, type: 'sine' });
        },
        groan: () => soundTone({
            freq: vary(94, 0.15), to: vary(58, 0.15), dur: rnd(0.7, 1.1),
            gain: 0.13, type: 'sawtooth', filter: { freq: 400 }
        }),
        swingTell: () => soundNoise({ dur: 0.24, freq: 880, gain: dedupe('tell', 0.15), filter: 'bandpass', q: 0.8 }),
        reload: (dur, key) => {
            const d = dur || 1.2;
            const pump = key === 'shotgun';
            soundNoise({ dur: 0.05, freq: 2100, gain: 0.16, filter: 'highpass' });
            window.setTimeout(() => soundNoise({ dur: 0.055, freq: 1750, gain: 0.2, filter: 'highpass' }), d * 420);
            window.setTimeout(() => soundNoise({
                dur: pump ? 0.16 : 0.07, freq: pump ? 900 : 2600,
                gain: pump ? 0.28 : 0.2, filter: pump ? 'lowpass' : 'highpass'
            }), d * 860);
        },
        hurt: () => {
            soundNoise({ dur: 0.22, freq: 680, sweep: 140, gain: 0.44 });
            soundTone({ freq: 146, to: 68, dur: 0.28, gain: 0.2, type: 'sawtooth' });
        },
        armorHit: () => {
            soundNoise({ dur: 0.12, freq: 2200, sweep: 800, gain: 0.24, filter: 'bandpass', q: 2 });
            soundTone({ freq: 880, to: 430, dur: 0.18, gain: 0.12, type: 'triangle' });
        },
        pickup: () => soundTone({ freq: 620, to: 1180, dur: 0.13, gain: 0.15, type: 'triangle' }),
        equip: () => {
            soundTone({ freq: 360, to: 820, dur: 0.22, gain: 0.18, type: 'triangle' });
            soundNoise({ dur: 0.09, freq: 1900, gain: 0.12, filter: 'highpass' });
        },
        search: () => soundNoise({ dur: 0.16, freq: 640, sweep: 380, gain: 0.18, filter: 'bandpass', q: 1.2 }),
        loot: () => {
            soundTone({ freq: 540, to: 880, dur: 0.16, gain: 0.16, type: 'triangle' });
            window.setTimeout(() => soundTone({ freq: 880, to: 1240, dur: 0.2, gain: 0.13, type: 'triangle' }), 100);
        },
        heal: () => {
            soundTone({ freq: 420, to: 760, dur: 0.3, gain: 0.16, type: 'sine' });
            soundNoise({ dur: 0.3, freq: 900, sweep: 1600, gain: 0.08, filter: 'bandpass' });
        },
        empty: () => soundNoise({ dur: 0.04, freq: 1500, gain: 0.12, filter: 'highpass' }),
        night: () => {
            soundTone({ freq: 130, to: 92, dur: 1.8, gain: 0.24, type: 'sawtooth', filter: { freq: 300 } });
            soundTone({ freq: 98, to: 146, dur: 1.8, gain: 0.18, type: 'triangle' });
        },
        siren: () => {
            soundTone({ freq: 420, to: 680, dur: 0.7, gain: 0.12, type: 'sine' });
            window.setTimeout(() => soundTone({ freq: 680, to: 420, dur: 0.7, gain: 0.12, type: 'sine' }), 700);
        },
        clear: () => {
            soundTone({ freq: 440, to: 660, dur: 0.5, gain: 0.18, type: 'triangle' });
            window.setTimeout(() => soundTone({ freq: 660, to: 990, dur: 0.65, gain: 0.2, type: 'triangle' }), 230);
            window.setTimeout(() => soundTone({ freq: 990, to: 1320, dur: 0.8, gain: 0.16, type: 'sine' }), 480);
        },
        death: () => {
            soundTone({ freq: 220, to: 46, dur: 1.9, gain: 0.28, type: 'sawtooth', filter: { freq: 500 } });
            soundNoise({ dur: 0.7, freq: 900, sweep: 110, gain: 0.28 });
        },
        heartbeat: () => {
            soundTone({ freq: 62, to: 40, dur: 0.16, gain: 0.3, type: 'sine' });
            window.setTimeout(() => soundTone({ freq: 56, to: 36, dur: 0.22, gain: 0.2, type: 'sine' }), 190);
        },
        dodge: () => soundNoise({ dur: 0.18, freq: 700, sweep: 220, gain: 0.2, filter: 'bandpass', q: 0.8 }),
        exitBeep: () => soundTone({ freq: 660, to: 880, dur: 0.2, gain: 0.09, type: 'sine' }),
        click: () => soundTone({ freq: 540, to: 720, dur: 0.06, gain: 0.08, type: 'triangle' })
    };

    function ensureAmbience() {
        if (!audio.ctx) { return; }
        const ctx = audio.ctx;
        if (!audio.drone) {
            const gain = ctx.createGain();
            gain.gain.value = 0;
            gain.connect(audio.master);
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 240;
            filter.connect(gain);
            [52, 55.5, 78].forEach((freq) => {
                const osc = ctx.createOscillator();
                osc.type = 'sawtooth';
                osc.frequency.value = freq;
                osc.connect(filter);
                osc.start();
            });
            audio.drone = filter;
            audio.droneGain = gain;
        }
        if (!audio.wind) {
            const gain = ctx.createGain();
            gain.gain.value = 0.018;
            gain.connect(audio.master);
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 380;
            filter.Q.value = 0.5;
            const src = ctx.createBufferSource();
            src.buffer = audio.noise;
            src.loop = true;
            src.connect(filter).connect(gain);
            src.start();
            audio.wind = filter;
            audio.windGain = gain;
        }
    }

    function setAmbience(night, muted) {
        if (!audio.ctx) { return; }
        ensureAmbience();
        const t = audio.ctx.currentTime;
        if (audio.droneGain) {
            audio.droneGain.gain.setTargetAtTime(night && !muted ? 0.055 : 0, t, 0.8);
        }
        if (audio.windGain) {
            audio.windGain.gain.setTargetAtTime(muted ? 0 : (night ? 0.028 : 0.016), t, 1.2);
        }
    }

    function toggleMute() {
        audio.muted = !audio.muted;
        if (audio.master) { audio.master.gain.value = audio.muted ? 0 : 0.42; }
        setAmbience(state.phase === 'night', audio.muted);
        try { window.localStorage.setItem(CFG.storeKey + '-mute', audio.muted ? '1' : '0'); } catch (e) { /* 忽略 */ }
        return audio.muted;
    }

    // ============================================================ 运行时状态
    let ui = null;
    let root = null;
    let stage = null;
    let canvas = null;
    let ctx = null;
    let worldCanvas = null;
    let worldCtx = null;
    let lightCanvas = null;
    let lightCtx = null;
    let minimapBase = null;
    let noiseTile = null;
    let fogTile = null;
    let vignette = null;
    let raf = 0;
    let lastTime = 0;
    let observer = null;
    let isTouch = false;
    let touchDevice = false;
    let destroyed = false;

    let W = 2800;
    let H = 1900;
    let theme = THEMES.rust;
    let level = LEVELS[0];
    let levelIndex = 0;

    const view = { scale: 0.9, w: 1250, h: 710, dpr: 1 };
    const cam = { x: 0, y: 0, tx: 0, ty: 0, shakeX: 0, shakeY: 0, shake: 0, shakeT: 0 };
    const pointer = { x: 0, y: 0, worldX: 0, worldY: 0, active: false, down: false };
    const mouse = { x: 0, y: 0 };

    const state = {
        phase: 'idle', level: 0, unlocked: 0, ranks: {},
        dayTimer: 75, time: 0, kills: 0, opened: 0, lootTotal: 0,
        active: false, paused: false, intro: 0, nightFade: 0,
        exitOpen: false, selected: 0, best: null, endTimer: 0, cinematic: false, levelStartLoadout: null,
        msg: '', msgT: 0, hintT: 0, newRank: null
    };

    const player = {
        x: 200, y: 1030, vx: 0, vy: 0, angle: 0, moveAngle: 0,
        hp: 100, armor: 0, stamina: 100, staminaDelay: 0,
        walk: 0, walkAmp: 0, moving: 0, recoil: 0, muzzle: 0,
        hurt: 0, invuln: 0, dodge: 0, dodgeCool: 0, dodgeDir: 0,
        dead: false, stepHalf: 0, breathe: 0, reloadT: 0, switchT: 0,
        flash: 0, aimDist: 260, kick: 0
    };

    const weapons = {};
    const ammo = { light: 0, shell: 0, heavy: 0 };
    let medkits = 0;

    let buildings = [];
    let walls = [];
    let fences = [];
    let structures = [];
    let props = [];
    let containers = [];
    let lights = [];
    let fires = [];
    let decals = [];
    let emissives = [];
    let solids = [];
    let circleSolids = [];
    let pickups = [];
    let zombies = [];
    let bullets = [];
    let particles = [];
    let tracers = [];
    let floaters = [];
    let corpses = [];
    let bloodStamps = [];
    let exitZone = null;

    const nav = {
        cols: 0, rows: 0, cell: CFG.grid,
        walk: null, dist: null, queue: null, head: 0, timer: 0, ready: false
    };

    const input = {
        up: false, down: false, left: false, right: false,
        sprint: false, fire: false, fireLatch: false, search: false,
        reload: false, heal: false, dodge: false, melee: false, switchTo: 0,
        moveX: 0, moveY: 0, aimX: 0, aimY: 0, touchAim: false
    };

    const search = { target: null, timer: 0, near: null, pulse: 0 };
    const melee = { cool: 0, anim: 0, angle: 0 };
    const screenshake = { v: 0 };
    const damageFlash = { v: 0 };
    const hitMarker = { t: 0, kill: false };
    const hint = { text: '', t: 0, color: '#ffc46b' };
    const toasts = [];
    let heartbeatTimer = 0;
    let groanTimer = 3;
    let exitBeep = 0;
    let lastPhaseShown = '';

    // ============================================================ 进度存档
    function loadProgress() {
        let data = null;
        try { data = JSON.parse(window.localStorage.getItem(CFG.storeKey) || 'null'); } catch (e) { data = null; }
        if (data && typeof data === 'object') {
            state.unlocked = clamp(Number(data.unlocked) || 0, 0, LEVELS.length - 1);
            state.ranks = data.ranks && typeof data.ranks === 'object' ? data.ranks : {};
        } else {
            // 从旧的横版存档迁移一次：只继承解锁进度
            let legacy = null;
            try { legacy = JSON.parse(window.localStorage.getItem(CFG.legacyKey) || 'null'); } catch (e) { legacy = null; }
            state.unlocked = legacy && legacy.unlocked ? clamp(Number(legacy.unlocked) || 0, 0, LEVELS.length - 1) : 0;
            state.ranks = {};
        }
        state.selected = state.unlocked;
        try {
            audio.muted = window.localStorage.getItem(CFG.storeKey + '-mute') === '1';
        } catch (e) { /* 忽略 */ }
    }

    function saveProgress() {
        try {
            window.localStorage.setItem(CFG.storeKey, JSON.stringify({
                unlocked: state.unlocked, ranks: state.ranks
            }));
        } catch (e) { /* 忽略 */ }
    }

    // ============================================================ 关卡构建
    function addSolid(x, y, w, h, kind) {
        solids.push({ x: x, y: y, w: w, h: h, kind: kind || 'prop' });
    }

    function addCircle(x, y, r, kind) {
        circleSolids.push({ x: x, y: y, r: r, kind: kind || 'prop' });
    }

    function buildLevel(index) {
        levelIndex = index;
        level = LEVELS[index];
        theme = THEMES[level.theme];
        W = level.w;
        H = level.h;

        if (worldCanvas) { worldCanvas.width = 1; worldCanvas.height = 1; }
        worldCanvas = null;
        worldCtx = null;
        buildings = [];
        walls = [];
        fences = [];
        structures = [];
        props = [];
        containers = [];
        lights = [];
        fires = [];
        decals = [];
        emissives = [];
        solids = [];
        circleSolids = [];
        pickups = [];
        zombies = [];
        bullets = [];
        particles = [];
        tracers = [];
        floaters = [];
        corpses = [];
        bloodStamps = [];

        for (const b of (level.buildings || [])) {
            buildings.push({
                x: b.x, y: b.y, w: b.w, h: b.h,
                style: b.style || 'office', sign: b.sign || '',
                hue: b.hue || '', seed: b.seed || (index * 97 + b.x),
                floors: b.floors || 2
            });
            addSolid(b.x, b.y, b.w, b.h, 'building');
        }

        for (const w of (level.walls || [])) {
            walls.push({ x: w.x, y: w.y, w: w.w, h: w.h, kind: w.kind || 'concrete' });
            addSolid(w.x, w.y, w.w, w.h, 'wall');
        }

        for (const f of (level.fences || [])) {
            const item = { x: f[1], y: f[2], w: f[3], h: f[4], kind: f[0] };
            fences.push(item);
            addSolid(item.x, item.y, item.w, item.h, 'fence');
        }

        for (const s of (level.structures || [])) {
            structures.push({ x: s.x, y: s.y, w: s.w, h: s.h, collapse: s.collapse || 0 });
            addSolid(s.x, s.y, s.w, s.h, 'deck');
        }

        for (const p of (level.props || [])) {
            const item = normalizeProp(p);
            if (!item) { continue; }
            props.push(item);
            if (item.solid) {
                if (item.circle) {
                    addCircle(item.x, item.y, item.r, item.t);
                } else {
                    addSolid(item.x - item.w / 2, item.y - item.h / 2, item.w, item.h, item.t);
                }
            }
            if (item.fire) {
                addFire(item.fireX || item.x, item.fireY || item.y, item.fireR || 100);
            }
        }

        for (const l of (level.lights || [])) {
            const light = { t: l.t, x: l.x, y: l.y, rot: l.rot || 0, w: l.w || 0, h: l.h || 0, r: l.r || 0, color: l.color || '', vertical: !!l.vertical, seed: lights.length * 13 + 3 };
            lights.push(light);
            if (l.t === 'fire') {
                addFire(l.x, l.y, l.r || 110);
            }
        }

        for (const c of (level.loot || [])) {
            containers.push({
                t: c.t, x: c.x, y: c.y, opened: false, seed: containers.length * 17 + 5,
                time: LOOT[c.t].time, glow: 0
            });
        }
        state.lootTotal = containers.length;
        state.opened = 0;

        decals = (level.decals || []).slice();

        exitZone = { x: level.exit[0], y: level.exit[1], type: level.exit[2], r: CFG.exit.radius, active: false, pulse: 0 };

        resetRun();
        buildNav();
        bakeWorld();
        bakeMinimap();

        player.x = level.spawn[0];
        player.y = level.spawn[1];
        cam.x = clamp(player.x - view.w / 2, 0, Math.max(0, W - view.w));
        cam.y = clamp(player.y - view.h / 2, 0, Math.max(0, H - view.h));
        cam.tx = cam.x; cam.ty = cam.y;
        updateNav(0, true);
    }

    function addFire(x, y, r) {
        for (const f of fires) {
            if (dist(f.x, f.y, x, y) < 40) { return; }
        }
        fires.push({ x: x, y: y, r: r, seed: fires.length * 17 + 3 });
    }

    function normalizeProp(p) {
        const t = p[0];
        const base = { t: t, x: 0, y: 0, rot: 0, w: 0, h: 0, r: 0, solid: true, circle: false, fire: false };
        if (t === 'car' || t === 'bus' || t === 'truck' || t === 'humvee' || t === 'tanker') {
            base.x = p[1]; base.y = p[2]; base.rot = p[3] || 0; base.kind = p[4] || 'sedan';
            let dims = {
                car: [128, 58], bus: [238, 94], truck: [196, 84],
                humvee: [154, 76], tanker: [250, 98]
            }[t];
            if (t === 'car') {
                dims = ({ truck: [196, 84], van: [142, 66], suv: [136, 64], police: [132, 60] })[base.kind] || dims;
            }
            base.w = base.rot ? dims[1] : dims[0];
            base.h = base.rot ? dims[0] : dims[1];
            base.fire = base.kind === 'burning';
            if (base.fire) { base.fireR = t === 'tanker' ? 180 : 100; }
            return base;
        }
        if (t === 'container') {
            base.x = p[1]; base.y = p[2]; base.w = p[3]; base.h = p[4];
            base.color = p[5] || '#4f5a54';
            return base;
        }
        if (t === 'crate') {
            base.x = p[1]; base.y = p[2]; base.size = p[3] || 30;
            base.w = base.size; base.h = base.size;
            return base;
        }
        if (t === 'cube') {
            base.x = p[1]; base.y = p[2]; base.size = 62;
            base.w = 62; base.h = 62;
            return base;
        }
        if (t === 'barrel') {
            base.x = p[1]; base.y = p[2]; base.burning = !!p[3];
            base.w = 34; base.h = 34; base.circle = true; base.r = 17;
            base.fire = base.burning; base.fireR = 95;
            return base;
        }
        if (t === 'tires') {
            base.x = p[1]; base.y = p[2]; base.n = p[3] || 4;
            base.w = 54; base.h = 54; base.circle = true; base.r = 27;
            base.solid = false;
            return base;
        }
        if (t === 'tree') {
            base.x = p[1]; base.y = p[2]; base.r = p[3] || 26; base.dead = p[4] !== false;
            base.circle = true; base.w = base.r * 2; base.h = base.r * 2;
            return base;
        }
        if (t === 'dumpster') {
            base.x = p[1]; base.y = p[2]; base.rot = p[3] || 0;
            base.w = base.rot ? 66 : 96; base.h = base.rot ? 96 : 66;
            return base;
        }
        if (t === 'crane') {
            base.x = p[1]; base.y = p[2]; base.w = 150; base.h = 120;
            return base;
        }
        if (t === 'generator') {
            base.x = p[1]; base.y = p[2]; base.w = 96; base.h = 60;
            return base;
        }
        if (t === 'barrier') {
            base.x = p[1]; base.y = p[2]; base.w = p[3]; base.h = p[4];
            return base;
        }
        if (t === 'column' || t === 'pillar') {
            base.x = p[1]; base.y = p[2]; base.w = p[3]; base.h = p[4];
            return base;
        }
        if (t === 'rubble') {
            base.x = p[1]; base.y = p[2]; base.r = p[3] || 70;
            base.w = base.r * 2; base.h = base.r * 1.3; base.solid = false;
            return base;
        }
        if (t === 'fountain') {
            base.x = p[1]; base.y = p[2]; base.r = p[3] || 80;
            base.circle = true; base.w = base.r * 2; base.h = base.r * 2;
            return base;
        }
        if (t === 'tank') {
            base.x = p[1]; base.y = p[2]; base.r = p[3] || 54;
            base.circle = true; base.w = base.r * 2; base.h = base.r * 2;
            return base;
        }
        if (t === 'planter') {
            base.x = p[1]; base.y = p[2]; base.r = p[3] || 26;
            base.circle = true; base.w = base.r * 2; base.h = base.r * 2;
            return base;
        }
        if (t === 'bench') {
            base.x = p[1]; base.y = p[2]; base.rot = p[3] || 0;
            base.w = base.rot ? 34 : 96; base.h = base.rot ? 96 : 34;
            return base;
        }
        if (t === 'cart') {
            base.x = p[1]; base.y = p[2]; base.w = 50; base.h = 38; base.solid = false;
            return base;
        }
        if (t === 'vending') {
            base.x = p[1]; base.y = p[2]; base.rot = p[3] || 0;
            base.w = base.rot ? 40 : 64; base.h = base.rot ? 64 : 40;
            return base;
        }
        if (t === 'phone') {
            base.x = p[1]; base.y = p[2]; base.w = 38; base.h = 38; base.solid = false;
            return base;
        }
        if (t === 'billboard') {
            base.x = p[1]; base.y = p[2]; base.w = p[3] || 360; base.h = 44;
            base.solid = false;
            return base;
        }
        if (t === 'canopy') {
            base.x = p[1]; base.y = p[2]; base.w = p[3]; base.h = p[4];
            base.solid = false;
            return base;
        }
        if (t === 'pump') {
            base.x = p[1]; base.y = p[2]; base.w = 64; base.h = 100;
            return base;
        }
        if (t === 'train') {
            base.x = p[1]; base.y = p[2]; base.w = p[3]; base.h = p[4];
            base.kind = p[5] || 'parked';
            return base;
        }
        if (t === 'ticketgate') {
            base.x = p[1]; base.y = p[2]; base.rot = p[3] || 0;
            base.w = base.rot ? 60 : 88; base.h = base.rot ? 88 : 60;
            return base;
        }
        if (t === 'trash') {
            base.x = p[1]; base.y = p[2]; base.w = 40; base.h = 30; base.solid = false;
            return base;
        }
        if (t === 'sandbag') {
            base.x = p[1]; base.y = p[2]; base.w = p[3]; base.h = p[4];
            return base;
        }
        if (t === 'watchtower') {
            base.x = p[1]; base.y = p[2]; base.w = 104; base.h = 104;
            return base;
        }
        if (t === 'tent') {
            base.x = p[1]; base.y = p[2]; base.w = p[3]; base.h = p[4];
            base.color = p[5] || '#4f5a4e';
            return base;
        }
        if (t === 'pylon') {
            base.x = p[1]; base.y = p[2]; base.rot = p[3] || 0;
            base.w = 250; base.h = 80; base.solid = false;
            return base;
        }
        if (t === 'subwaysign') {
            base.x = p[1]; base.y = p[2]; base.w = p[3] || 320; base.h = 54;
            base.text = p[4] || '04 号线 · 废土站'; base.solid = false;
            return base;
        }
        if (t === 'windsock') {
            base.x = p[1]; base.y = p[2]; base.rot = p[3] || 0;
            base.w = 60; base.h = 30; base.solid = false;
            return base;
        }
        if (t === 'bollard') {
            base.x = p[1]; base.y = p[2];
            base.w = 16; base.h = 16; base.solid = false;
            return base;
        }
        if (t === 'watertank') {
            base.x = p[1]; base.y = p[2]; base.r = p[3] || 44;
            base.circle = true; base.w = base.r * 2; base.h = base.r * 2;
            return base;
        }
        return null;
    }

    function resetRun() {
        player.x = level.spawn[0];
        player.y = level.spawn[1];
        player.vx = 0; player.vy = 0;
        player.angle = 0; player.moveAngle = 0;
        player.hp = CFG.player.hp; player.armor = 0;
        player.stamina = CFG.player.stamina; player.staminaDelay = 0;
        player.walk = 0; player.walkAmp = 0; player.moving = 0;
        player.recoil = 0; player.muzzle = 0; player.hurt = 0;
        player.invuln = 0; player.dodge = 0; player.dodgeCool = 0;
        player.dead = false; player.stepHalf = 0; player.breathe = 0;
        player.reloadT = 0; player.switchT = 0; player.flash = 0;
        player.aimDist = 260; player.kick = 0;

        for (const key of WEAPON_ORDER) {
            weapons[key] = {
                owned: key === 'pistol', mag: key === 'pistol' ? 12 : 0,
                cool: 0, reloading: 0, reloadTime: 0, kick: 0
            };
        }
        ammo.light = 60; ammo.shell = 0; ammo.heavy = 0;
        medkits = 1;
        state.current = 'pistol';
        state.kills = 0;
        state.opened = 0;
        state.time = 0;
        state.phase = 'idle';
        state.exitOpen = false;
        state.nightFade = 0;
        state.intro = 0;
        state.waveCount = 0;
        state.dayTimer = level.time;
        state.endTimer = 0;
        state.newRank = null;
        search.target = null; search.timer = 0; search.near = null;
        melee.cool = 0; melee.anim = 0;
        damageFlash.v = 0; screenshake.v = 0;
        toasts.length = 0;
        heartbeatTimer = 0;
        for (const key of WEAPON_ORDER) { weapons[key].cool = 0; }
        for (const c of containers) { c.opened = false; c.glow = 0; }
        state.lootTotal = containers.length || state.lootTotal;
        if (exitZone) { exitZone.active = false; }
    }

    // 跨关装备快照：武器、弹匣、备弹、医疗包、护甲。
    // 进入下一区时继承；死亡重试时回滚到本区开始时的状态。
    function captureLoadout() {
        const snap = { weapons: {}, ammo: { light: ammo.light, shell: ammo.shell, heavy: ammo.heavy },
            medkits: medkits, armor: player.armor, current: state.current, hp: player.hp };
        for (const key of WEAPON_ORDER) {
            snap.weapons[key] = { owned: weapons[key].owned, mag: weapons[key].mag };
        }
        return snap;
    }

    function applyLoadout(snap) {
        if (!snap) { return; }
        for (const key of WEAPON_ORDER) {
            const src = snap.weapons && snap.weapons[key];
            const w = WEAPONS[key];
            const slot = weapons[key];
            slot.owned = !!(src && src.owned);
            slot.mag = clamp(src ? Math.round(src.mag) : 0, 0, w.mag);
            slot.cool = 0; slot.reloading = 0; slot.reloadTime = 0; slot.kick = 0;
        }
        if (snap.ammo) {
            ammo.light = clamp(Math.round(snap.ammo.light) || 0, 0, ammoCap('light'));
            ammo.shell = clamp(Math.round(snap.ammo.shell) || 0, 0, ammoCap('shell'));
            ammo.heavy = clamp(Math.round(snap.ammo.heavy) || 0, 0, ammoCap('heavy'));
        }
        medkits = clamp(Math.round(snap.medkits) || 0, 0, 6);
        player.armor = clamp(Math.round(snap.armor) || 0, 0, CFG.player.armorMax);
        let current = snap.current;
        if (!current || !weapons[current] || !weapons[current].owned) {
            current = WEAPON_ORDER.find((k) => weapons[k].owned) || 'pistol';
        }
        state.current = current;
        player.reloadT = 0;
        player.switchT = 0;
    }

    function loadoutWeaponNames() {
        const names = WEAPON_ORDER.filter((k) => weapons[k].owned).map((k) => WEAPONS[k].cn);
        return names.length ? names.join(' / ') : '空手';
    }

    function loadoutSummary() {
        const ammoParts = [];
        if (ammo.light > 0) { ammoParts.push('9mm×' + ammo.light); }
        if (ammo.shell > 0) { ammoParts.push('12G×' + ammo.shell); }
        if (ammo.heavy > 0) { ammoParts.push('5.56×' + ammo.heavy); }
        return loadoutWeaponNames() + ' · 备弹 ' + (ammoParts.join(' / ') || '无') +
            ' · 医疗包×' + medkits + ' · 护甲 ' + Math.round(player.armor);
    }

    // ============================================================ 导航网格
    function buildNav() {
        nav.cell = CFG.grid;
        nav.cols = Math.ceil(W / nav.cell);
        nav.rows = Math.ceil(H / nav.cell);
        nav.walk = new Uint8Array(nav.cols * nav.rows);
        nav.dist = new Int32Array(nav.cols * nav.rows);
        nav.queue = new Int32Array(nav.cols * nav.rows);
        nav.ready = false;
        const pad = player.r + 3;

        for (let cy = 0; cy < nav.rows; cy++) {
            for (let cx = 0; cx < nav.cols; cx++) {
                const x = cx * nav.cell + nav.cell / 2;
                const y = cy * nav.cell + nav.cell / 2;
                let ok = 1;
                for (const s of solids) {
                    if (circleRect(x, y, pad, s)) { ok = 0; break; }
                }
                if (ok) {
                    for (const c of circleSolids) {
                        const dx = x - c.x, dy = y - c.y;
                        if (dx * dx + dy * dy < (c.r + pad) * (c.r + pad)) { ok = 0; break; }
                    }
                }
                nav.walk[cy * nav.cols + cx] = ok;
            }
        }
    }

    function updateNav(dt, force) {
        nav.timer -= dt;
        if (!force && nav.timer > 0) { return; }
        nav.timer = 0.28;
        const cols = nav.cols, rows = nav.rows, cell = nav.cell;
        const dist = nav.dist, queue = nav.queue;
        dist.fill(-1);
        let sx = clamp(Math.floor(player.x / cell), 0, cols - 1);
        let sy = clamp(Math.floor(player.y / cell), 0, rows - 1);
        let start = sy * cols + sx;
        if (!nav.walk[start]) {
            // 玩家被挤进障碍时，就近找一个可走格
            let found = -1;
            for (let r = 1; r < 6 && found < 0; r++) {
                for (let oy = -r; oy <= r && found < 0; oy++) {
                    for (let ox = -r; ox <= r; ox++) {
                        const nx = sx + ox, ny = sy + oy;
                        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) { continue; }
                        if (nav.walk[ny * cols + nx]) { found = ny * cols + nx; break; }
                    }
                }
            }
            if (found < 0) { nav.ready = false; return; }
            start = found;
        }
        dist[start] = 0;
        queue[0] = start;
        let head = 0, tail = 1;
        while (head < tail) {
            const cur = queue[head++];
            const cx = cur % cols;
            const cy = (cur - cx) / cols;
            const d = dist[cur] + 1;
            for (let oy = -1; oy <= 1; oy++) {
                for (let ox = -1; ox <= 1; ox++) {
                    if (!ox && !oy) { continue; }
                    const nx = cx + ox, ny = cy + oy;
                    if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) { continue; }
                    const ni = ny * cols + nx;
                    if (dist[ni] !== -1 || !nav.walk[ni]) { continue; }
                    if (ox && oy && (!nav.walk[cy * cols + nx] || !nav.walk[ny * cols + cx])) { continue; }
                    dist[ni] = d;
                    queue[tail++] = ni;
                }
            }
        }
        nav.ready = true;
    }

    function navAt(x, y) {
        if (!nav.ready) { return -1; }
        const cx = clamp(Math.floor(x / nav.cell), 0, nav.cols - 1);
        const cy = clamp(Math.floor(y / nav.cell), 0, nav.rows - 1);
        return nav.dist[cy * nav.cols + cx];
    }

    // ============================================================ 世界烘焙
    function makeNoiseTile(seed, dark, light, size, count) {
        const c = document.createElement('canvas');
        c.width = size; c.height = size;
        const g = c.getContext('2d');
        g.fillStyle = 'rgba(0,0,0,0)';
        g.fillRect(0, 0, size, size);
        const rand = seeded(seed);
        for (let i = 0; i < count; i++) {
            const x = Math.floor(rand() * size);
            const y = Math.floor(rand() * size);
            const a = 0.03 + rand() * 0.12;
            g.fillStyle = rand() < 0.5 ? rgba(dark, a) : rgba(light, a);
            const s = rand() < 0.92 ? 1 : 2;
            g.fillRect(x, y, s, s);
        }
        return c;
    }

    function makeFogTile() {
        const c = document.createElement('canvas');
        c.width = 256; c.height = 256;
        const g = c.getContext('2d');
        const rand = seeded(4401);
        for (let i = 0; i < 26; i++) {
            const x = rand() * 256, y = rand() * 256, r = 30 + rand() * 70;
            const grad = g.createRadialGradient(x, y, 0, x, y, r);
            grad.addColorStop(0, 'rgba(210,220,225,0.10)');
            grad.addColorStop(1, 'rgba(210,220,225,0)');
            g.fillStyle = grad;
            g.fillRect(0, 0, 256, 256);
        }
        return c;
    }

    function bakeWorld() {
        worldCanvas = document.createElement('canvas');
        worldCanvas.width = W;
        worldCanvas.height = H;
        worldCtx = worldCanvas.getContext('2d');
        const g = worldCtx;

        noiseTile = makeNoiseTile(9182, theme.baseDark, theme.baseLight, 192, 1500);
        fogTile = makeFogTile();

        paintGround(g);
        paintRoads(g);
        paintDecals(g);
        paintGlobalShadows(g);

        for (const b of buildings) { drawBuilding(g, b); }
        for (const w of walls) { drawWall(g, w); }
        for (const s of structures) { drawDeck(g, s); }
        paintGraffiti(g);
        for (const f of fences) { drawFence(g, f); }
        for (const p of props) { drawProp(g, p); }
        paintEdgeWeeds(g);
        paintCables(g);
        paintLightFixtures(g);

        // 地面大范围色偏和雾气，让整张图有统一的空气感
        const haze = g.createLinearGradient(0, 0, W, H);
        haze.addColorStop(0, theme.haze);
        haze.addColorStop(0.55, 'rgba(0,0,0,0)');
        haze.addColorStop(1, rgba(theme.night, 0.09));
        g.fillStyle = haze;
        g.fillRect(0, 0, W, H);

        g.globalAlpha = 0.35;
        g.fillStyle = g.createPattern(noiseTile, 'repeat');
        g.fillRect(0, 0, W, H);
        g.globalAlpha = 1;
    }

    function paintGround(g) {
        g.fillStyle = theme.base;
        g.fillRect(0, 0, W, H);

        // 大尺度明暗斑块
        const rand = seeded(levelIndex * 311 + 7);
        for (let i = 0; i < 70; i++) {
            const x = rand() * W, y = rand() * H;
            const r = 90 + rand() * 260;
            const grad = g.createRadialGradient(x, y, 0, x, y, r);
            const dark = rand() < 0.55;
            grad.addColorStop(0, dark ? rgba(theme.baseDark, 0.16) : rgba(theme.baseLight, 0.12));
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = grad;
            g.fillRect(x - r, y - r, r * 2, r * 2);
        }

        for (const z of (level.zones || [])) {
            drawZone(g, z);
        }
    }

    function drawZone(g, z) {
        const t = z[0], x = z[1], y = z[2], w = z[3], h = z[4];
        if (w <= 0 || h <= 0) { return; }
        g.save();
        if (t === 'road' || t === 'asphalt') {
            g.fillStyle = theme.asphalt;
            g.fillRect(x, y, w, h);
            g.fillStyle = g.createPattern(noiseTile, 'repeat');
            g.globalAlpha = 0.8;
            g.fillRect(x, y, w, h);
            g.globalAlpha = 0.35;
            const grad = g.createLinearGradient(x, y, x, y + h);
            grad.addColorStop(0, 'rgba(255,255,255,0.04)');
            grad.addColorStop(0.5, 'rgba(0,0,0,0)');
            grad.addColorStop(1, 'rgba(0,0,0,0.14)');
            g.fillStyle = grad;
            g.fillRect(x, y, w, h);
            g.globalAlpha = 1;
            // 路缘
            g.fillStyle = rgba(theme.asphalt2, 0.9);
            g.fillRect(x, y, w, 2);
            g.fillRect(x, y + h - 2, w, 2);
        } else if (t === 'sidewalk' || t === 'concrete' || t === 'platform') {
            g.fillStyle = t === 'platform' ? theme.concrete : theme.concrete;
            g.fillRect(x, y, w, h);
            g.globalAlpha = 0.5;
            g.fillStyle = g.createPattern(noiseTile, 'repeat');
            g.fillRect(x, y, w, h);
            g.globalAlpha = 1;
            const step = 86;
            g.strokeStyle = rgba(theme.trim, 0.22);
            g.lineWidth = 1;
            for (let sx = x; sx < x + w; sx += step) {
                g.beginPath(); g.moveTo(sx, y); g.lineTo(sx, y + h); g.stroke();
            }
            for (let sy = y; sy < y + h; sy += step) {
                g.beginPath(); g.moveTo(x, sy); g.lineTo(x + w, sy); g.stroke();
            }
            if (t !== 'platform') {
                g.fillStyle = rgba(theme.curb, 0.9);
                g.fillRect(x, y, w, 3);
                g.fillStyle = 'rgba(0,0,0,0.18)';
                g.fillRect(x, y + 3, w, 2);
            }
        } else if (t === 'dirt') {
            g.fillStyle = theme.dirt;
            g.fillRect(x, y, w, h);
            g.globalAlpha = 0.7;
            g.fillStyle = g.createPattern(noiseTile, 'repeat');
            g.fillRect(x, y, w, h);
            g.globalAlpha = 1;
        } else if (t === 'grass') {
            g.fillStyle = theme.grass;
            g.fillRect(x, y, w, h);
            const rand = seeded(x * 3 + y * 7 + levelIndex);
            for (let i = 0; i < (w * h) / 500; i++) {
                const gx = x + rand() * w, gy = y + rand() * h;
                g.strokeStyle = rgba(shade(theme.grass, rand() < 0.5 ? -0.25 : 0.22), 0.55);
                g.lineWidth = 1;
                g.beginPath();
                g.moveTo(gx, gy);
                g.lineTo(gx + (rand() - 0.5) * 4, gy - 2 - rand() * 4);
                g.stroke();
            }
        } else if (t === 'tile') {
            g.fillStyle = theme.concrete;
            g.fillRect(x, y, w, h);
            const tile = 96;
            g.strokeStyle = 'rgba(0,0,0,0.22)';
            g.lineWidth = 2;
            for (let sx = x; sx < x + w; sx += tile) {
                g.beginPath(); g.moveTo(sx, y); g.lineTo(sx, y + h); g.stroke();
            }
            for (let sy = y; sy < y + h; sy += tile) {
                g.beginPath(); g.moveTo(x, sy); g.lineTo(x + w, sy); g.stroke();
            }
            g.globalAlpha = 0.4;
            g.fillStyle = g.createPattern(noiseTile, 'repeat');
            g.fillRect(x, y, w, h);
            g.globalAlpha = 1;
            g.fillStyle = 'rgba(255,255,255,0.03)';
            g.fillRect(x, y, w, 2);
        } else if (t === 'tracks') {
            g.fillStyle = shade(theme.concrete, -0.28);
            g.fillRect(x, y, w, h);
            g.globalAlpha = 0.7;
            g.fillStyle = g.createPattern(noiseTile, 'repeat');
            g.fillRect(x, y, w, h);
            g.globalAlpha = 1;
            // 道砟
            const rand = seeded(x + y * 11 + levelIndex);
            for (let i = 0; i < (w * h) / 180; i++) {
                const px = x + rand() * w, py = y + rand() * h;
                g.fillStyle = rand() < 0.5 ? 'rgba(30,34,34,0.55)' : 'rgba(140,140,128,0.28)';
                g.fillRect(px, py, 2, 2);
            }
            // 枕木与铁轨
            const railY1 = y + h * 0.28, railY2 = y + h * 0.66;
            for (let sx = x + 12; sx < x + w; sx += 58) {
                g.fillStyle = '#3a3028';
                g.fillRect(sx, railY1 - 20, 22, 68);
                g.fillStyle = 'rgba(255,255,255,0.06)';
                g.fillRect(sx, railY1 - 20, 22, 2);
            }
            g.fillStyle = '#6f7674';
            g.fillRect(x, railY1, w, 5);
            g.fillRect(x, railY2, w, 5);
            g.fillStyle = 'rgba(255,255,255,0.28)';
            g.fillRect(x, railY1, w, 1);
            g.fillRect(x, railY2, w, 1);
            g.fillStyle = 'rgba(0,0,0,0.4)';
            g.fillRect(x, railY1 + 5, w, 3);
            g.fillRect(x, railY2 + 5, w, 3);
        } else if (t === 'helipad') {
            g.fillStyle = shade(theme.concrete, -0.06);
            g.fillRect(x, y, w, h);
            g.globalAlpha = 0.5;
            g.fillStyle = g.createPattern(noiseTile, 'repeat');
            g.fillRect(x, y, w, h);
            g.globalAlpha = 1;
            const cx = x + w / 2, cy = y + h / 2, rr = Math.min(w, h) * 0.4;
            // 降落坪圆盘
            g.fillStyle = 'rgba(16,20,19,0.28)';
            g.beginPath(); g.arc(cx, cy, rr + 12, 0, TAU); g.fill();
            g.fillStyle = 'rgba(26,31,29,0.26)';
            g.beginPath(); g.arc(cx, cy, rr, 0, TAU); g.fill();
            g.strokeStyle = 'rgba(230,225,200,0.52)';
            g.lineWidth = 6;
            g.beginPath(); g.arc(cx, cy, rr, 0, TAU); g.stroke();
            g.strokeStyle = 'rgba(225,190,80,0.4)';
            g.lineWidth = 3;
            g.setLineDash([26, 18]);
            g.beginPath(); g.arc(cx, cy, rr + 18, 0, TAU); g.stroke();
            g.setLineDash([]);
            // H
            g.strokeStyle = 'rgba(238,235,215,0.28)';
            g.lineWidth = 15;
            g.lineCap = 'butt';
            g.beginPath();
            g.moveTo(cx - rr * 0.42, cy - rr * 0.5);
            g.lineTo(cx - rr * 0.42, cy + rr * 0.5);
            g.moveTo(cx + rr * 0.42, cy - rr * 0.5);
            g.lineTo(cx + rr * 0.42, cy + rr * 0.5);
            g.moveTo(cx - rr * 0.42, cy);
            g.lineTo(cx + rr * 0.42, cy);
            g.stroke();
            // 编号 / 方位
            g.fillStyle = 'rgba(230,225,205,0.32)';
            g.font = '700 16px monospace';
            g.textAlign = 'center';
            g.fillText('LZ-06', cx, cy + rr + 38);
            g.save();
            g.translate(cx, cy + rr + 62);
            g.strokeStyle = 'rgba(225,190,80,0.28)';
            g.lineWidth = 2;
            g.beginPath(); g.moveTo(-36, 0); g.lineTo(36, 0); g.stroke();
            g.fillStyle = 'rgba(225,190,80,0.32)';
            g.beginPath(); g.moveTo(36, 0); g.lineTo(26, -6); g.lineTo(26, 6); g.closePath(); g.fill();
            g.restore();
        } else if (t === 'water') {
            g.fillStyle = theme.water;
            g.fillRect(x, y, w, h);
        }
        g.restore();
    }

    function paintRoads(g) {
        for (const z of (level.zones || [])) {
            if (z[0] !== 'road') { continue; }
            const x = z[1], y = z[2], w = z[3], h = z[4];
            const dir = z[5] || (w > h ? 'h' : 'v');
            g.save();
            g.strokeStyle = rgba(theme.asphaltLine, 0.5);
            g.lineWidth = 4;
            g.setLineDash([34, 30]);
            g.beginPath();
            if (dir === 'h') {
                g.moveTo(x + 20, y + h / 2);
                g.lineTo(x + w - 20, y + h / 2);
            } else {
                g.moveTo(x + w / 2, y + 20);
                g.lineTo(x + w / 2, y + h - 20);
            }
            g.stroke();
            g.setLineDash([]);
            g.strokeStyle = rgba(theme.asphaltLine, 0.22);
            g.lineWidth = 3;
            g.beginPath();
            if (dir === 'h') {
                g.moveTo(x + 20, y + 16); g.lineTo(x + w - 20, y + 16);
                g.moveTo(x + 20, y + h - 16); g.lineTo(x + w - 20, y + h - 16);
            } else {
                g.moveTo(x + 16, y + 20); g.lineTo(x + 16, y + h - 20);
                g.moveTo(x + w - 16, y + 20); g.lineTo(x + w - 16, y + h - 20);
            }
            g.stroke();
            g.restore();
        }

        // 斑马线：放在两条道路交叉口附近
        const roads = (level.zones || []).filter((z) => z[0] === 'road');
        for (let i = 0; i < roads.length; i++) {
            for (let j = 0; j < roads.length; j++) {
                if (i === j) { continue; }
                const a = roads[i], b = roads[j];
                const ax = a[1], ay = a[2], aw = a[3], ah = a[4];
                const bx = b[1], by = b[2], bw = b[3], bh = b[4];
                if (bx > ax + aw || bx + bw < ax || by > ay + ah || by + bh < ay) { continue; }
                const cx = Math.max(ax, bx), cy = Math.max(ay, by);
                const cw = Math.min(ax + aw, bx + bw) - cx;
                const ch = Math.min(ay + ah, by + bh) - cy;
                if (cw < 20 || ch < 20) { continue; }
                g.save();
                g.fillStyle = rgba(theme.asphaltLine, 0.24);
                const count = 6;
                for (let k = 0; k < count; k++) {
                    if (ch > cw) {
                        g.fillRect(cx + 10, cy + 12 + k * 22, cw - 20, 11);
                    } else {
                        g.fillRect(cx + 12 + k * 22, cy + 10, 11, ch - 20);
                    }
                }
                g.restore();
            }
        }

        // 车道箭头
        const rand = seeded(levelIndex * 97 + 300);
        for (const z of (level.zones || [])) {
            if (z[0] !== 'road') { continue; }
            const x = z[1], y = z[2], w = z[3], h = z[4];
            for (let k = 0; k < 2; k++) {
                const ax = x + w * (0.2 + k * 0.5);
                const ay = y + h / 2;
                g.save();
                g.globalAlpha = 0.16;
                g.fillStyle = theme.asphaltLine;
                g.beginPath();
                g.moveTo(ax - 15, ay - 9);
                g.lineTo(ax + 4, ay - 9);
                g.lineTo(ax + 4, ay - 16);
                g.lineTo(ax + 20, ay);
                g.lineTo(ax + 4, ay + 16);
                g.lineTo(ax + 4, ay + 9);
                g.lineTo(ax - 15, ay + 9);
                g.closePath();
                g.fill();
                g.restore();
            }
            if (rand() < 0.5) { break; }
        }
    }

    function paintSurfaceWear(g, z) {
        const t = z[0], x = z[1], y = z[2], w = z[3], h = z[4];
        const rand = seeded(Math.floor(x * 17 + y * 23 + levelIndex * 59) + 7);
        g.save();
        // 大块旧污渍 / 水渍（面积大的地面必须限流，否则整片会变成斑点）
        const stainCount = clamp(Math.floor(w * h / 90000), 2, 14);
        for (let i = 0; i < stainCount; i++) {
            const px = x + rand() * w;
            const py = y + rand() * h;
            const r = 20 + rand() * 70;
            const grad = g.createRadialGradient(px, py, 0, px, py, r);
            grad.addColorStop(0, rand() < 0.4 ? 'rgba(10,12,12,0.20)' : 'rgba(90,80,62,0.12)');
            grad.addColorStop(1, 'rgba(10,12,12,0)');
            g.fillStyle = grad;
            g.fillRect(px - r, py - r, r * 2, r * 2);
        }
        // 裂缝 / 拼缝错位
        for (let i = 0; i < Math.max(1, Math.floor(w / 260)); i++) {
            let cx = x + 20 + rand() * (w - 40);
            let cy = y + 20 + rand() * (h - 40);
            g.strokeStyle = 'rgba(0,0,0,0.28)';
            g.lineWidth = 1;
            g.beginPath();
            g.moveTo(cx, cy);
            for (let k = 0; k < 7; k++) {
                cx += (rand() - 0.5) * 26;
                cy += (rand() - 0.5) * 14;
                g.lineTo(cx, cy);
            }
            g.stroke();
        }
        // 口香糖、纸屑、烟头
        for (let i = 0; i < Math.max(6, Math.floor(w * h / 9000)); i++) {
            const px = x + rand() * w;
            const py = y + rand() * h;
            if (rand() < 0.6) {
                g.fillStyle = 'rgba(15,15,13,0.25)';
                g.beginPath(); g.arc(px, py, 1.5 + rand() * 2.5, 0, TAU); g.fill();
            } else {
                g.fillStyle = 'rgba(205,198,175,0.16)';
                g.save();
                g.translate(px, py);
                g.rotate(rand() * TAU);
                g.fillRect(0, 0, 2 + rand() * 5, 1 + rand() * 3);
                g.restore();
            }
        }
        // 瓷砖破损：只留少量，别把站厅铺成斑点
        if (t === 'tile') {
            const broken = clamp(Math.floor(w * h / 90000), 4, 18);
            for (let i = 0; i < broken; i++) {
                const px = x + rand() * w;
                const py = y + rand() * h;
                g.fillStyle = 'rgba(12,16,16,0.22)';
                g.fillRect(px, py, 12 + rand() * 22, 8 + rand() * 14);
                g.fillStyle = 'rgba(180,190,180,0.05)';
                g.fillRect(px, py, 12, 2);
            }
            // 墙根水渍
            const grad = g.createLinearGradient(x, y, x, y + 60);
            grad.addColorStop(0, 'rgba(6,12,12,0.30)');
            grad.addColorStop(1, 'rgba(6,12,12,0)');
            g.fillStyle = grad;
            g.fillRect(x, y, w, 60);
        }
        // 站台边缘黄色安全线
        if (t === 'platform') {
            g.fillStyle = 'rgba(205,175,60,0.35)';
            g.fillRect(x, y + 18, w, 5);
            g.fillRect(x, y + h - 23, w, 5);
            g.fillStyle = 'rgba(220,220,200,0.16)';
            for (let sx = x + 20; sx < x + w; sx += 34) {
                g.fillRect(sx, y + 18, 18, 5);
                g.fillRect(sx, y + h - 23, 18, 5);
            }
        }
        // 直升机坪：轮胎擦痕 + 油渍
        if (t === 'helipad') {
            for (let i = 0; i < 3; i++) {
                g.strokeStyle = 'rgba(5,6,5,0.28)';
                g.lineWidth = 8;
                g.beginPath();
                g.moveTo(x + w * 0.22, y + h * (0.3 + i * 0.16));
                g.quadraticCurveTo(x + w * 0.5, y + h * (0.45 + i * 0.1), x + w * 0.78, y + h * (0.36 + i * 0.12));
                g.stroke();
            }
            for (let i = 0; i < 4; i++) {
                const px = x + w * (0.32 + rand() * 0.36);
                const py = y + h * (0.3 + rand() * 0.4);
                g.fillStyle = 'rgba(8,8,7,0.22)';
                g.beginPath(); g.ellipse(px, py, 20 + rand() * 30, 10 + rand() * 14, rand() * 2, 0, TAU); g.fill();
            }
            // 警示黄圈 + 边灯
            const cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) * 0.4;
            g.setLineDash([18, 14]);
            g.strokeStyle = 'rgba(220,190,80,0.35)';
            g.lineWidth = 2;
            g.beginPath(); g.arc(cx, cy, r + 14, 0, TAU); g.stroke();
            g.setLineDash([]);
            for (let i = 0; i < 12; i++) {
                const a = i / 12 * TAU;
                const lx = cx + Math.cos(a) * (r + 14);
                const ly = cy + Math.sin(a) * (r + 14);
                g.fillStyle = i % 2 ? 'rgba(120,255,180,0.55)' : 'rgba(255,220,130,0.35)';
                g.beginPath(); g.arc(lx, ly, 2.5, 0, TAU); g.fill();
            }
        }
        // 湿气 / 苔藓：只沿边缘铺少量，中央保持干净
        if (theme.weather === 'rain' || level.key === 'subway') {
            const puddles = level.key === 'subway' ? 5 : clamp(Math.floor(w / 240), 2, 8);
            for (let i = 0; i < puddles; i++) {
                const edge = rand() < 0.5;
                const px = x + 30 + rand() * Math.max(10, w - 60);
                const py = edge ? y + 18 + rand() * 40 : y + h - 18 - rand() * 40;
                drawDecal(g, 'puddle', px, py, 24 + rand() * 40);
            }
        }
        g.restore();
    }

    function paintRoadWear(g, z) {
        const x = z[1], y = z[2], w = z[3], h = z[4];
        const rand = seeded(Math.floor(x * 13 + y * 7 + levelIndex * 97) + 1);
        g.save();
        // 路边积尘 / 破碎的沥青边缘
        for (let i = 0; i < Math.floor(w / 26); i++) {
            const ex = x + rand() * w;
            const edge = rand() < 0.5 ? y + 2 : y + h - 3;
            g.fillStyle = rand() < 0.5 ? rgba(theme.dirt, 0.24) : rgba(theme.concrete, 0.10);
            g.beginPath();
            g.ellipse(ex, edge + (rand() - 0.5) * 9, 8 + rand() * 26, 2 + rand() * 5, 0, 0, TAU);
            g.fill();
        }
        // 裂缝
        for (let i = 0; i < Math.floor(w / 260) + 1; i++) {
            let cx = x + 40 + rand() * (w - 80);
            let cy = y + 20 + rand() * (h - 40);
            g.strokeStyle = 'rgba(6,7,6,0.28)';
            g.lineWidth = 1.2;
            g.beginPath();
            g.moveTo(cx, cy);
            for (let k = 0; k < 9; k++) {
                cx += (rand() - 0.5) * 30;
                cy += (rand() - 0.5) * 18;
                g.lineTo(cx, cy);
            }
            g.stroke();
        }
        // 坑洞
        for (let i = 0; i < Math.floor(w / 420) + 1; i++) {
            const px = x + 60 + rand() * (w - 120);
            const py = y + 26 + rand() * (h - 52);
            const pr = 8 + rand() * 16;
            const grad = g.createRadialGradient(px, py, 0, px, py, pr);
            grad.addColorStop(0, 'rgba(4,5,4,0.62)');
            grad.addColorStop(0.7, 'rgba(10,10,8,0.38)');
            grad.addColorStop(1, 'rgba(10,10,8,0)');
            g.fillStyle = grad;
            g.beginPath();
            g.ellipse(px, py, pr, pr * 0.62, 0, 0, TAU);
            g.fill();
            g.strokeStyle = 'rgba(180,170,145,0.10)';
            g.lineWidth = 1;
            g.beginPath();
            g.ellipse(px - 2, py - 2, pr * 0.72, pr * 0.4, 0, 0, TAU);
            g.stroke();
        }
        // 刹车痕
        for (let i = 0; i < Math.floor(w / 700) + 1; i++) {
            const sx = x + 80 + rand() * (w - 200);
            const sy = y + 30 + rand() * (h - 60);
            g.strokeStyle = 'rgba(5,5,4,0.22)';
            g.lineWidth = 3;
            g.beginPath();
            g.moveTo(sx, sy);
            g.quadraticCurveTo(sx + 60, sy - 22, sx + 150, sy + 6);
            g.stroke();
            g.beginPath();
            g.moveTo(sx + 6, sy + 16);
            g.quadraticCurveTo(sx + 66, sy - 6, sx + 156, sy + 22);
            g.stroke();
        }
        // 井盖 / 排水口
        if (rand() < 0.85) {
            const mx = x + 70 + rand() * (w - 140);
            const my = y + h * (0.3 + rand() * 0.4);
            g.fillStyle = 'rgba(8,9,8,0.4)';
            g.beginPath(); g.arc(mx + 2, my + 3, 13, 0, TAU); g.fill();
            g.fillStyle = shade(theme.metal, -0.18);
            g.beginPath(); g.arc(mx, my, 12, 0, TAU); g.fill();
            g.strokeStyle = 'rgba(230,225,200,0.12)';
            g.lineWidth = 1;
            g.beginPath(); g.arc(mx, my, 9, 0, TAU); g.stroke();
            g.beginPath();
            g.moveTo(mx - 7, my); g.lineTo(mx + 7, my);
            g.moveTo(mx, my - 7); g.lineTo(mx, my + 7);
            g.stroke();
        }
        // 车道线的磨损白斑
        for (let i = 0; i < Math.floor(w / 120); i++) {
            const lx = x + rand() * w;
            g.fillStyle = 'rgba(230,220,190,0.045)';
            g.fillRect(lx, y + h / 2 - 2, 12 + rand() * 26, 4);
        }
        g.restore();
    }

    function paintDirtWear(g, z) {
        const x = z[1], y = z[2], w = z[3], h = z[4];
        const rand = seeded(Math.floor(x * 5 + y * 11 + levelIndex * 41) + 3);
        g.save();
        // 旧车辙
        for (let i = 0; i < 3; i++) {
            const sy = y + 30 + rand() * (h - 60);
            g.strokeStyle = 'rgba(20,16,12,0.16)';
            g.lineWidth = 7;
            g.beginPath();
            g.moveTo(x + 30, sy);
            g.bezierCurveTo(x + w * 0.3, sy + 20, x + w * 0.6, sy - 20, x + w - 30, sy + 10);
            g.stroke();
            g.strokeStyle = 'rgba(210,200,175,0.05)';
            g.lineWidth = 2;
            g.beginPath();
            g.moveTo(x + 30, sy - 5);
            g.bezierCurveTo(x + w * 0.3, sy + 15, x + w * 0.6, sy - 25, x + w - 30, sy + 5);
            g.stroke();
        }
        // 枯草与碎石
        for (let i = 0; i < Math.floor(w * h / 14000); i++) {
            const gx = x + rand() * w;
            const gy = y + rand() * h;
            if (rand() < 0.55) {
                g.strokeStyle = rgba(theme.grass, 0.35);
                g.lineWidth = 1;
                g.beginPath();
                g.moveTo(gx, gy);
                g.lineTo(gx + (rand() - 0.5) * 8, gy - 3 - rand() * 7);
                g.stroke();
            } else {
                g.fillStyle = 'rgba(170,160,140,0.10)';
                g.fillRect(gx, gy, 1 + rand() * 3, 1 + rand() * 2);
            }
        }
        g.restore();
    }

    function paintDecals(g) {
        for (const d of decals) {
            drawDecal(g, d[0], d[1], d[2], d[3]);
        }
        for (const z of (level.zones || [])) {
            if (z[0] === 'road') { paintRoadWear(g, z); }
            else if (z[0] === 'dirt') { paintDirtWear(g, z); }
            else if (z[0] === 'sidewalk' || z[0] === 'concrete' || z[0] === 'platform' || z[0] === 'tile' || z[0] === 'helipad') {
                paintSurfaceWear(g, z);
            }
        }
        // 自动补一些碎屑、纸片和裂纹，不逐帧抖动
        const rand = seeded(levelIndex * 701 + 33);
        for (let i = 0; i < 320; i++) {
            const x = rand() * W, y = rand() * H;
            const kind = rand();
            if (kind < 0.45) {
                g.fillStyle = rand() < 0.5 ? 'rgba(40,36,30,0.34)' : 'rgba(180,170,150,0.14)';
                g.fillRect(x, y, 1 + rand() * 3, 1 + rand() * 2);
            } else if (kind < 0.7) {
                g.fillStyle = 'rgba(200,195,175,0.18)';
                g.save();
                g.translate(x, y);
                g.rotate(rand() * TAU);
                g.fillRect(0, 0, 5 + rand() * 7, 3 + rand() * 4);
                g.restore();
            } else if (kind < 0.9) {
                g.strokeStyle = 'rgba(0,0,0,0.28)';
                g.lineWidth = 1;
                let cx = x, cy = y;
                g.beginPath();
                g.moveTo(cx, cy);
                for (let k = 0; k < 4; k++) {
                    cx += (rand() - 0.5) * 24;
                    cy += rand() * 18;
                    g.lineTo(cx, cy);
                }
                g.stroke();
            }
        }
        if (level.key === 'subway') {
            g.save();
            g.globalAlpha = 0.10;
            g.fillStyle = '#cfe9e3';
            g.font = '800 58px "PingFang SC","Microsoft YaHei",sans-serif';
            g.textAlign = 'left';
            g.fillText('04 号线 · 废土站', 540, 1130);
            g.globalAlpha = 0.08;
            g.font = '700 26px monospace';
            g.fillText('→ EAST SERVICE EXIT', 2440, 1120);
            g.restore();
        }
        if (level.key === 'gas') {
            g.save();
            g.globalAlpha = 0.08;
            g.fillStyle = '#f2d27a';
            g.font = '900 92px "PingFang SC","Microsoft YaHei",sans-serif';
            g.textAlign = 'center';
            g.fillText('FUEL', 1230, 910);
            g.globalAlpha = 0.13;
            g.fillStyle = '#d9b558';
            g.fillRect(880, 690, 700, 7);
            g.fillRect(880, 860, 700, 7);
            g.fillStyle = 'rgba(20,18,14,0.55)';
            for (let i = 0; i < 18; i++) {
                g.fillRect(890 + i * 38, 690, 18, 7);
                g.fillRect(890 + i * 38, 860, 18, 7);
            }
            g.restore();
        }
        if (theme.weather === 'rain') {
            const rand2 = seeded(levelIndex * 811 + 5);
            for (let i = 0; i < 18; i++) {
                drawDecal(g, 'puddle', rand2() * W, rand2() * H, 40 + rand2() * 80);
            }
        }
    }

    function drawDecal(g, kind, x, y, size) {
        g.save();
        if (kind === 'oil') {
            const r = size || 70;
            const grad = g.createRadialGradient(x, y, 0, x, y, r);
            grad.addColorStop(0, 'rgba(8,8,10,0.5)');
            grad.addColorStop(0.6, 'rgba(12,12,14,0.3)');
            grad.addColorStop(1, 'rgba(12,12,14,0)');
            g.fillStyle = grad;
            g.beginPath();
            g.ellipse(x, y, r, r * 0.62, 0, 0, TAU);
            g.fill();
            g.fillStyle = 'rgba(120,150,150,0.08)';
            g.beginPath();
            g.ellipse(x - r * 0.15, y - r * 0.08, r * 0.3, r * 0.12, -0.3, 0, TAU);
            g.fill();
        } else if (kind === 'puddle') {
            const r = size || 70;
            const grad = g.createRadialGradient(x, y, 0, x, y, r);
            grad.addColorStop(0, 'rgba(20,34,40,0.55)');
            grad.addColorStop(0.72, 'rgba(24,42,48,0.38)');
            grad.addColorStop(1, 'rgba(24,42,48,0)');
            g.fillStyle = grad;
            g.beginPath();
            g.ellipse(x, y, r, r * 0.52, 0, 0, TAU);
            g.fill();
            g.strokeStyle = 'rgba(160,210,215,0.16)';
            g.lineWidth = 1;
            g.beginPath();
            g.ellipse(x, y, r * 0.7, r * 0.38, 0, 0, TAU);
            g.stroke();
            g.fillStyle = 'rgba(190,225,235,0.10)';
            g.beginPath();
            g.ellipse(x, y - r * 0.05, r * 0.55, r * 0.18, 0, 0, TAU);
            g.fill();
            g.fillStyle = 'rgba(255,235,190,0.05)';
            g.beginPath();
            g.ellipse(x + r * 0.2, y + r * 0.02, r * 0.3, r * 0.05, -0.2, 0, TAU);
            g.fill();
            g.fillStyle = 'rgba(200,230,235,0.10)';
            g.beginPath();
            g.ellipse(x - r * 0.2, y - r * 0.1, r * 0.22, r * 0.06, -0.4, 0, TAU);
            g.fill();
        } else if (kind === 'blood') {
            const r = size || 50;
            const rand = seeded(Math.floor(x * 7 + y * 13));
            for (let i = 0; i < 9; i++) {
                const a = rand() * TAU, rr = rand() * r;
                g.fillStyle = rgba(theme.blood, 0.35 + rand() * 0.3);
                g.beginPath();
                g.ellipse(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.6, 3 + rand() * 10, 2 + rand() * 6, rand() * 3, 0, TAU);
                g.fill();
            }
            g.fillStyle = rgba(theme.blood, 0.4);
            g.beginPath();
            g.ellipse(x, y, r * 0.42, r * 0.26, 0, 0, TAU);
            g.fill();
        } else if (kind === 'bones') {
            g.translate(x, y);
            g.rotate(Math.random() * 0);
            g.strokeStyle = 'rgba(198,190,168,0.4)';
            g.lineWidth = 3;
            g.lineCap = 'round';
            for (let i = 0; i < 4; i++) {
                g.beginPath();
                g.moveTo(-20 + i * 13, -8 + (i % 2) * 13);
                g.lineTo(-12 + i * 13, 8 + (i % 2) * 5);
                g.stroke();
            }
            g.fillStyle = 'rgba(205,198,178,0.4)';
            g.beginPath();
            g.arc(18, 10, 7, 0, TAU);
            g.fill();
        } else if (kind === 'crack') {
            g.strokeStyle = 'rgba(0,0,0,0.32)';
            g.lineWidth = 2;
            let cx = x, cy = y;
            g.beginPath();
            g.moveTo(cx, cy);
            for (let i = 0; i < 9; i++) {
                cx += (i % 2 ? 1 : -1) * (8 + Math.random() * 10);
                cy += 12 + Math.random() * 14;
                g.lineTo(cx, cy);
                if (i === 4) {
                    g.moveTo(cx, cy);
                    g.lineTo(cx + 24, cy + 8);
                    g.moveTo(cx, cy);
                }
            }
            g.stroke();
        } else if (kind === 'paper') {
            g.translate(x, y);
            g.rotate(Math.random() * TAU);
            g.fillStyle = 'rgba(205,200,180,0.28)';
            g.fillRect(-5, -3, 10, 7);
            g.fillStyle = 'rgba(40,40,40,0.25)';
            g.fillRect(-4, -1, 7, 1);
        }
        g.restore();
    }

    // ============================================================ 建筑
    function withShadow(g, blur, ox, oy, color, draw) {
        g.save();
        g.shadowColor = color;
        g.shadowBlur = blur;
        g.shadowOffsetX = ox;
        g.shadowOffsetY = oy;
        draw();
        g.restore();
    }

    function drawBuilding(g, b) {
        const rand = seeded(b.seed || 1);
        const accent = b.hue || theme.accent;
        g.save();

        if (b.style === 'tent') {
            drawTentBuilding(g, b, accent, rand);
            g.restore();
            return;
        }
        if (b.style === 'house') {
            drawHouseBuilding(g, b, accent, rand);
            g.restore();
            return;
        }

        // 投影：所有建筑统一向右下投，保证光照方向一致
        withShadow(g, 34, 20, 24, 'rgba(0,0,0,0.55)', () => {
            g.fillStyle = theme.wall;
            roundRect(g, b.x, b.y, b.w, b.h, 2);
            g.fill();
        });

        // 南侧与东侧可见的墙体
        const wallH = 22;
        g.fillStyle = shade(theme.wall2, -0.08);
        g.fillRect(b.x + 8, b.y + b.h - wallH, b.w - 8, wallH);
        g.fillStyle = 'rgba(0,0,0,0.22)';
        g.fillRect(b.x + 8, b.y + b.h - 4, b.w - 8, 4);
        g.fillStyle = shade(theme.wall2, 0.08);
        g.fillRect(b.x + b.w - 9, b.y + 6, 9, b.h - 6);

        // 屋顶
        const inset = 9;
        const rx = b.x + inset, ry = b.y + inset;
        const rw = b.w - inset * 2, rh = b.h - inset * 2;
        const roofGrad = g.createLinearGradient(rx, ry, rx + rw, ry + rh);
        roofGrad.addColorStop(0, shade(theme.roof, 0.13));
        roofGrad.addColorStop(0.45, theme.roof);
        roofGrad.addColorStop(1, shade(theme.roof, -0.18));
        g.fillStyle = roofGrad;
        g.fillRect(rx, ry, rw, rh);

        // 屋顶材质
        if (b.style === 'warehouse' || b.style === 'shed') {
            g.strokeStyle = 'rgba(0,0,0,0.18)';
            g.lineWidth = 2;
            for (let sx = rx + 8; sx < rx + rw; sx += 14) {
                g.beginPath();
                g.moveTo(sx, ry + 2);
                g.lineTo(sx, ry + rh - 2);
                g.stroke();
            }
            g.fillStyle = 'rgba(255,255,255,0.05)';
            for (let sx = rx + 9; sx < rx + rw; sx += 14) {
                g.fillRect(sx, ry + 2, 1, rh - 4);
            }
        } else {
            g.globalAlpha = 0.5;
            g.fillStyle = g.createPattern(noiseTile, 'repeat');
            g.fillRect(rx, ry, rw, rh);
            g.globalAlpha = 1;
            // 屋顶接缝
            g.strokeStyle = 'rgba(0,0,0,0.16)';
            g.lineWidth = 1;
            for (let sy = ry + 40; sy < ry + rh; sy += 58) {
                g.beginPath(); g.moveTo(rx, sy); g.lineTo(rx + rw, sy); g.stroke();
            }
        }

        // 女儿墙
        g.strokeStyle = shade(theme.roof, 0.22);
        g.lineWidth = 3;
        g.strokeRect(rx + 1.5, ry + 1.5, rw - 3, rh - 3);
        g.strokeStyle = 'rgba(0,0,0,0.4)';
        g.lineWidth = 2;
        g.strokeRect(rx + 4, ry + 4, rw - 8, rh - 8);
        g.fillStyle = shade(theme.roof, 0.30);
        g.fillRect(rx, ry, rw, 3);
        g.fillStyle = shade(theme.roof, -0.30);
        g.fillRect(rx, ry + rh - 4, rw, 4);
        g.fillRect(rx + rw - 3, ry, 3, rh);

        // 屋顶污渍
        for (let i = 0; i < 6; i++) {
            const sx = rx + 20 + rand() * Math.max(10, rw - 60);
            const sy = ry + 20 + rand() * Math.max(10, rh - 60);
            const rr = 14 + rand() * 44;
            const grad = g.createRadialGradient(sx, sy, 0, sx, sy, rr);
            grad.addColorStop(0, 'rgba(10,8,6,0.20)');
            grad.addColorStop(1, 'rgba(10,8,6,0)');
            g.fillStyle = grad;
            g.fillRect(sx - rr, sy - rr, rr * 2, rr * 2);
        }

        drawRoofDetails(g, b, rx, ry, rw, rh, rand);
        drawFacade(g, b, accent, rand);

        // 楼顶广告牌（只在部分建筑上）
        if (b.style === 'shop' || b.style === 'station') {
            drawRoofSign(g, b, accent, rand);
        }

        g.restore();
    }

    function drawRoofDetails(g, b, rx, ry, rw, rh, rand) {
        const count = 1 + Math.floor(rand() * 3);
        for (let i = 0; i < count; i++) {
            if (rw < 160 || rh < 120) { break; }
            const x = rx + 30 + rand() * (rw - 130);
            const y = ry + 26 + rand() * (rh - 120);
            const kind = rand();
            g.save();
            if (kind < 0.48) {
                // 空调外机
                g.fillStyle = 'rgba(0,0,0,0.35)';
                g.fillRect(x + 5, y + 6, 52, 34);
                g.fillStyle = '#6d7471';
                roundRect(g, x, y, 52, 34, 3);
                g.fill();
                g.fillStyle = '#878e88';
                g.fillRect(x + 3, y + 3, 46, 4);
                g.strokeStyle = 'rgba(20,24,22,0.65)';
                g.lineWidth = 1.5;
                for (let k = 0; k < 5; k++) {
                    g.beginPath();
                    g.moveTo(x + 10 + k * 8, y + 10);
                    g.lineTo(x + 10 + k * 8, y + 28);
                    g.stroke();
                }
                g.fillStyle = 'rgba(255,255,255,0.16)';
                g.beginPath(); g.arc(x + 44, y + 10, 5, 0, TAU); g.fill();
            } else if (kind < 0.68) {
                // 通风管
                g.fillStyle = 'rgba(0,0,0,0.3)';
                g.beginPath(); g.ellipse(x + 4, y + 5, 15, 15, 0, 0, TAU); g.fill();
                g.fillStyle = '#767b74';
                g.beginPath(); g.arc(x, y, 14, 0, TAU); g.fill();
                g.fillStyle = '#3f4541';
                g.beginPath(); g.arc(x, y, 8, 0, TAU); g.fill();
                g.strokeStyle = 'rgba(230,230,220,0.2)';
                g.lineWidth = 1;
                g.beginPath(); g.arc(x, y, 12, 0, TAU); g.stroke();
            } else if (kind < 0.84) {
                // 天窗
                g.fillStyle = 'rgba(0,0,0,0.3)';
                g.fillRect(x + 4, y + 5, 60, 38);
                const grad = g.createLinearGradient(x, y, x + 60, y + 38);
                grad.addColorStop(0, 'rgba(160,200,205,0.42)');
                grad.addColorStop(0.5, 'rgba(70,100,108,0.45)');
                grad.addColorStop(1, 'rgba(140,180,188,0.3)');
                g.fillStyle = grad;
                g.fillRect(x, y, 60, 38);
                g.strokeStyle = '#4b4f49';
                g.lineWidth = 3;
                g.strokeRect(x, y, 60, 38);
                g.fillStyle = 'rgba(255,255,255,0.25)';
                g.beginPath();
                g.moveTo(x + 6, y + 34);
                g.lineTo(x + 34, y + 4);
                g.lineTo(x + 46, y + 4);
                g.lineTo(x + 16, y + 34);
                g.closePath(); g.fill();
            } else {
                // 水箱
                g.fillStyle = 'rgba(0,0,0,0.3)';
                g.beginPath(); g.ellipse(x + 5, y + 7, 26, 15, 0, 0, TAU); g.fill();
                g.fillStyle = '#5e625b';
                g.beginPath(); g.arc(x, y, 24, 0, TAU); g.fill();
                g.fillStyle = '#7b8078';
                g.beginPath(); g.arc(x, y, 19, 0, TAU); g.fill();
                g.strokeStyle = '#4b4f49';
                g.lineWidth = 2;
                g.beginPath(); g.arc(x, y, 12, 0, TAU); g.stroke();
                g.fillStyle = 'rgba(255,255,255,0.12)';
                g.beginPath(); g.arc(x - 6, y - 6, 8, 0, TAU); g.fill();
            }
            g.restore();
        }
        // 天线
        if (rand() < 0.45) {
            const ax = rx + 30 + rand() * (rw - 60);
            const ay = ry + 24 + rand() * (rh - 48);
            g.strokeStyle = '#3b3f3a';
            g.lineWidth = 2;
            g.beginPath();
            g.moveTo(ax, ay);
            g.lineTo(ax + 30, ay - 20);
            g.stroke();
            g.beginPath(); g.arc(ax + 30, ay - 20, 2, 0, TAU); g.fillStyle = '#ff6a4a'; g.fill();
        }
    }

    function drawFacade(g, b, accent, rand) {
        const wallH = 24;
        const y = b.y + b.h - wallH;
        const x = b.x + 8;
        const w = b.w - 17;
        const style = b.style;

        g.fillStyle = shade(theme.wall2, -0.12);
        g.fillRect(x, y, w, wallH);
        g.fillStyle = 'rgba(255,255,255,0.07)';
        g.fillRect(x, y, w, 2);
        g.fillStyle = 'rgba(0,0,0,0.28)';
        g.fillRect(x, y + wallH - 3, w, 3);

        const windows = Math.max(2, Math.floor(w / 92));
        for (let i = 0; i < windows; i++) {
            const wx = x + 18 + i * ((w - 36) / Math.max(1, windows - 1));
            if (Math.abs(wx - (x + w / 2)) < 38) { continue; }
            const ww = 26, wh = 11;
            g.fillStyle = style === 'station' ? 'rgba(255,215,150,0.38)' : 'rgba(24,32,38,0.9)';
            g.fillRect(wx - ww / 2, y + 6, ww, wh);
            g.strokeStyle = 'rgba(180,180,160,0.18)';
            g.lineWidth = 1;
            g.strokeRect(wx - ww / 2, y + 6, ww, wh);
            emissives.push({
                t: 'window', x: wx, y: y + 11, w: ww, h: wh,
                color: style === 'station' ? '#ffd28a' : (rand() < 0.32 ? '#ffc07a' : '#6f8e9a'),
                power: style === 'station' ? 0.45 : (rand() < 0.25 ? 0.5 : 0)
            });
        }

        const doorX = x + w / 2;
        g.fillStyle = 'rgba(14,18,20,0.9)';
        g.fillRect(doorX - 24, y + 4, 48, wallH - 4);
        g.strokeStyle = rgba(accent, 0.3);
        g.lineWidth = 1.5;
        g.strokeRect(doorX - 24, y + 4, 48, wallH - 4);
        if (style === 'shop' || style === 'station') {
            g.fillStyle = rgba(accent, 0.20);
            g.fillRect(doorX - 21, y + 7, 42, wallH - 8);
        }

        if (style === 'shop' || style === 'station') {
            // 雨棚 / 门头
            const awningH = 17;
            const ay = y - awningH + 1;
            const stripes = Math.max(4, Math.floor(w / 34));
            for (let i = 0; i < stripes; i++) {
                g.fillStyle = i % 2 === 0 ? accent : shade(accent, -0.35);
                g.globalAlpha = 0.75;
                g.fillRect(x + i * (w / stripes), ay, w / stripes, awningH);
            }
            g.globalAlpha = 1;
            g.fillStyle = 'rgba(0,0,0,0.22)';
            g.fillRect(x, ay + awningH - 2, w, 3);
            g.strokeStyle = 'rgba(0,0,0,0.4)';
            g.lineWidth = 1;
            g.strokeRect(x, ay, w, awningH);
            // 门头招牌
            const sw = Math.min(w - 20, 260);
            const sx = x + (w - sw) / 2;
            const sy = y - awningH - 23;
            g.fillStyle = 'rgba(12,14,15,0.9)';
            g.fillRect(sx, sy, sw, 22);
            g.strokeStyle = rgba(accent, 0.55);
            g.lineWidth = 1;
            g.strokeRect(sx, sy, sw, 22);
            g.fillStyle = rgba(accent, 0.9);
            g.font = '600 15px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.fillText(b.sign || '', sx + sw / 2, sy + 12);
            emissives.push({ t: 'sign', x: sx + sw / 2, y: sy + 11, w: sw, h: 18, color: accent, power: 0.75 });
            if (b.style === 'shop') {
                // 侧挂竖招牌
                const vx = x + 6;
                const vy = y - 92;
                g.fillStyle = 'rgba(10,12,13,0.92)';
                g.fillRect(vx, vy, 24, 58);
                g.strokeStyle = rgba(accent, 0.6);
                g.strokeRect(vx, vy, 24, 58);
                g.fillStyle = rgba(accent, 0.85);
                g.font = '600 13px "PingFang SC","Hiragino Sans GB",sans-serif';
                const chars = (b.sign || '').slice(0, 2);
                for (let c = 0; c < chars.length; c++) {
                    g.fillText(chars[c], vx + 12, vy + 18 + c * 20);
                }
                emissives.push({ t: 'sign', x: vx + 12, y: vy + 29, w: 30, h: 58, color: accent, power: 0.55 });
            }
        } else if (b.style === 'shed') {
            const sw = Math.min(w - 30, 150);
            g.fillStyle = 'rgba(10,12,11,0.85)';
            g.fillRect(doorX - sw / 2, y + 4, sw, 18);
            g.strokeStyle = rgba(accent, 0.35);
            g.lineWidth = 1;
            g.strokeRect(doorX - sw / 2, y + 4, sw, 18);
            g.fillStyle = rgba(accent, 0.72);
            g.font = '600 11px "PingFang SC","Microsoft YaHei",sans-serif';
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.fillText(b.sign || '仓库', doorX, y + 13);
            emissives.push({ t: 'sign', x: doorX, y: y + 13, w: sw, h: 14, color: accent, power: 0.25 });
        } else if (b.style === 'warehouse') {
            // 卷帘门
            const dw = Math.min(120, w * 0.4);
            g.fillStyle = '#434943';
            g.fillRect(doorX - dw / 2, y + 2, dw, wallH - 2);
            g.strokeStyle = 'rgba(0,0,0,0.35)';
            g.lineWidth = 2;
            for (let sy = y + 5; sy < y + wallH; sy += 4) {
                g.beginPath(); g.moveTo(doorX - dw / 2 + 2, sy); g.lineTo(doorX + dw / 2 - 2, sy); g.stroke();
            }
            g.fillStyle = 'rgba(220,200,150,0.18)';
            g.font = '600 10px sans-serif';
            g.textAlign = 'center';
            g.fillText((b.sign || '仓库'), doorX, y - 13);
        } else {
            // 办公楼入口
            const dw = 86;
            g.fillStyle = 'rgba(10,14,16,0.92)';
            g.fillRect(doorX - dw / 2, y + 3, dw, wallH - 3);
            g.strokeStyle = 'rgba(180,190,180,0.25)';
            g.strokeRect(doorX - dw / 2, y + 3, dw, wallH - 3);
            g.fillStyle = 'rgba(255,220,160,0.10)';
            g.fillRect(doorX - dw / 2 + 4, y + 6, dw - 8, wallH - 8);
        }

        // 墙面涂鸦 / 锈迹
        if (rand() < 0.5) {
            g.strokeStyle = rgba(accent, 0.32);
            g.lineWidth = 2;
            g.beginPath();
            let gx = x + 40 + rand() * Math.max(10, w - 120);
            g.moveTo(gx, y + 18);
            for (let i = 0; i < 4; i++) {
                gx += 8 + rand() * 12;
                g.lineTo(gx, y + 10 + rand() * 12);
            }
            g.stroke();
        }
    }

    function drawRoofSign(g, b, accent, rand) {
        if (b.w < 220) { return; }
        const sw = Math.min(b.w * 0.6, 300);
        const sx = b.x + (b.w - sw) / 2;
        const sy = b.y + b.h - 64;
        g.fillStyle = 'rgba(10,12,14,0.9)';
        g.fillRect(sx, sy, sw, 34);
        g.strokeStyle = rgba(accent, 0.5);
        g.lineWidth = 2;
        g.strokeRect(sx, sy, sw, 34);
        g.fillStyle = rgba(accent, 0.8);
        g.font = '700 20px "PingFang SC","Hiragino Sans GB",sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(b.sign || '', sx + sw / 2, sy + 18);
        emissives.push({ t: 'sign', x: sx + sw / 2, y: sy + 17, w: sw, h: 30, color: accent, power: 0.65 });
        for (let i = 0; i < 4; i++) {
            g.fillStyle = 'rgba(40,44,40,0.8)';
            g.fillRect(sx + 12 + i * (sw - 24) / 3, sy - 8, 4, 8);
        }
    }

    function drawHouseBuilding(g, b, accent, rand) {
        withShadow(g, 30, 18, 22, 'rgba(0,0,0,0.5)', () => {
            g.fillStyle = theme.wall;
            g.fillRect(b.x, b.y, b.w, b.h);
        });
        const roof = b.hue && b.hue.length ? b.hue : shade(theme.roof, -0.08);
        const ridgeY = b.y + b.h * 0.48;
        const gradA = g.createLinearGradient(b.x, b.y, b.x, ridgeY);
        gradA.addColorStop(0, shade(roof, -0.12));
        gradA.addColorStop(1, shade(roof, 0.12));
        g.fillStyle = gradA;
        g.beginPath();
        g.moveTo(b.x, b.y);
        g.lineTo(b.x + b.w, b.y);
        g.lineTo(b.x + b.w - 8, ridgeY);
        g.lineTo(b.x + 8, ridgeY);
        g.closePath();
        g.fill();
        const gradB = g.createLinearGradient(b.x, ridgeY, b.x, b.y + b.h);
        gradB.addColorStop(0, shade(roof, 0.08));
        gradB.addColorStop(1, shade(roof, -0.28));
        g.fillStyle = gradB;
        g.beginPath();
        g.moveTo(b.x + 8, ridgeY);
        g.lineTo(b.x + b.w - 8, ridgeY);
        g.lineTo(b.x + b.w, b.y + b.h);
        g.lineTo(b.x, b.y + b.h);
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.3)';
        g.lineWidth = 3;
        g.beginPath(); g.moveTo(b.x + 4, ridgeY); g.lineTo(b.x + b.w - 4, ridgeY); g.stroke();
        g.strokeStyle = 'rgba(0,0,0,0.16)';
        g.lineWidth = 1;
        for (let i = 1; i < 8; i++) {
            const t = i / 8;
            g.beginPath();
            g.moveTo(b.x + b.w * t, b.y + 4);
            g.lineTo(b.x + 8 + (b.w - 16) * t, ridgeY);
            g.stroke();
        }
        // 烟囱
        if (b.w > 260) {
            const cx = b.x + b.w * 0.72;
            g.fillStyle = 'rgba(0,0,0,0.35)';
            g.fillRect(cx + 4, b.y + 22, 30, 24);
            g.fillStyle = shade(theme.wall2, -0.05);
            g.fillRect(cx, b.y + 18, 30, 24);
            g.fillStyle = 'rgba(255,255,255,0.1)';
            g.fillRect(cx, b.y + 18, 30, 3);
        }
        // 入口
        g.fillStyle = 'rgba(10,12,12,0.9)';
        g.fillRect(b.x + b.w / 2 - 22, b.y + b.h - 18, 44, 18);
        emissives.push({ t: 'window', x: b.x + b.w / 2, y: b.y + b.h - 10, w: 30, h: 10, color: '#ffbe78', power: rand() < 0.5 ? 0.4 : 0 });
    }

    function drawTentBuilding(g, b, accent, rand) {
        withShadow(g, 26, 16, 20, 'rgba(0,0,0,0.5)', () => {
            g.fillStyle = b.hue || '#4b554a';
            roundRect(g, b.x, b.y, b.w, b.h, 12);
            g.fill();
        });
        const base = b.hue || '#4b554a';
        const grad = g.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
        grad.addColorStop(0, shade(base, 0.12));
        grad.addColorStop(0.5, base);
        grad.addColorStop(1, shade(base, -0.2));
        g.fillStyle = grad;
        roundRect(g, b.x + 4, b.y + 4, b.w - 8, b.h - 8, 10);
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.28)';
        g.lineWidth = 2;
        for (let i = 1; i < 5; i++) {
            const t = i / 5;
            g.beginPath();
            g.moveTo(b.x + 8 + (b.w - 16) * t, b.y + 8);
            g.lineTo(b.x + 8 + (b.w - 16) * t, b.y + b.h - 8);
            g.stroke();
        }
        g.strokeStyle = 'rgba(255,255,255,0.08)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(b.x + 12, b.y + b.h * 0.4);
        g.lineTo(b.x + b.w - 12, b.y + b.h * 0.4);
        g.stroke();
        // 门帘
        g.fillStyle = 'rgba(12,14,13,0.75)';
        g.fillRect(b.x + b.w / 2 - 26, b.y + b.h - 10, 52, 10);
        // 伪装网
        g.strokeStyle = 'rgba(30,36,28,0.28)';
        g.lineWidth = 1;
        for (let i = 0; i < 7; i++) {
            g.beginPath();
            g.moveTo(b.x + 6 + rand() * (b.w - 12), b.y + 6);
            g.lineTo(b.x + 6 + rand() * (b.w - 12), b.y + b.h - 6);
            g.stroke();
        }
        if (b.sign && b.sign.indexOf('医疗') >= 0) {
            g.fillStyle = 'rgba(235,235,225,0.72)';
            g.beginPath(); g.arc(b.x + b.w / 2, b.y + b.h / 2, 22, 0, TAU); g.fill();
            g.fillStyle = 'rgba(178,52,44,0.85)';
            g.fillRect(b.x + b.w / 2 - 5, b.y + b.h / 2 - 15, 10, 30);
            g.fillRect(b.x + b.w / 2 - 15, b.y + b.h / 2 - 5, 30, 10);
            emissives.push({ t: 'sign', x: b.x + b.w / 2, y: b.y + b.h / 2, w: 44, h: 44, color: '#ff6b5a', power: 0.25 });
        }
        if (b.sign) {
            g.fillStyle = 'rgba(14,16,14,0.85)';
            const sw = Math.min(180, b.w - 30);
            g.fillRect(b.x + (b.w - sw) / 2, b.y + 14, sw, 22);
            g.fillStyle = rgba(accent, 0.85);
            g.font = '600 14px "PingFang SC","Hiragino Sans GB",sans-serif';
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.fillText(b.sign, b.x + b.w / 2, b.y + 26);
            emissives.push({ t: 'sign', x: b.x + b.w / 2, y: b.y + 25, w: sw, h: 18, color: accent, power: 0.35 });
        }
    }

    function drawWall(g, w) {
        g.save();
        withShadow(g, 18, 10, 12, 'rgba(0,0,0,0.45)', () => {
            g.fillStyle = w.kind === 'tile' ? theme.wall2 : theme.concrete;
            g.fillRect(w.x, w.y, w.w, w.h);
        });
        if (w.kind === 'tile') {
            const tile = 44;
            for (let x = w.x; x < w.x + w.w; x += tile) {
                for (let y = w.y; y < w.y + w.h; y += tile) {
                    g.fillStyle = ((Math.floor(x / tile) + Math.floor(y / tile)) % 2 === 0) ? shade(theme.wall2, 0.06) : shade(theme.wall2, -0.06);
                    g.fillRect(x + 1, y + 1, Math.min(tile, w.x + w.w - x) - 2, Math.min(tile, w.y + w.h - y) - 2);
                }
            }
        } else {
            g.fillStyle = g.createPattern(noiseTile, 'repeat');
            g.globalAlpha = 0.5;
            g.fillRect(w.x, w.y, w.w, w.h);
            g.globalAlpha = 1;
            g.strokeStyle = 'rgba(0,0,0,0.2)';
            g.lineWidth = 1;
            if (w.w > w.h) {
                for (let x = w.x + 80; x < w.x + w.w; x += 80) {
                    g.beginPath(); g.moveTo(x, w.y); g.lineTo(x, w.y + w.h); g.stroke();
                }
            } else {
                for (let y = w.y + 80; y < w.y + w.h; y += 80) {
                    g.beginPath(); g.moveTo(w.x, y); g.lineTo(w.x + w.w, y); g.stroke();
                }
            }
        }
        g.fillStyle = 'rgba(255,255,255,0.12)';
        g.fillRect(w.x, w.y, w.w, 2);
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.fillRect(w.x, w.y + w.h - 3, w.w, 3);
        g.restore();
    }

    function drawDeck(g, s) {
        g.save();
        // 高架在地面上的深投影
        g.shadowColor = 'rgba(0,0,0,0.55)';
        g.shadowBlur = 42;
        g.shadowOffsetX = 26;
        g.shadowOffsetY = 34;
        g.fillStyle = theme.concrete;
        g.fillRect(s.x, s.y, s.w, s.h);
        g.shadowColor = 'transparent';

        // 桥侧立面
        const faceH = 26;
        g.fillStyle = shade(theme.concrete, -0.26);
        g.fillRect(s.x, s.y + s.h - faceH, s.w, faceH);
        g.fillStyle = 'rgba(0,0,0,0.22)';
        g.fillRect(s.x, s.y + s.h - 5, s.w, 5);
        g.fillStyle = 'rgba(255,255,255,0.06)';
        g.fillRect(s.x, s.y + s.h - faceH, s.w, 3);

        // 桥面
        const top = s.y + 6;
        const topH = s.h - faceH - 6;
        const grad = g.createLinearGradient(s.x, top, s.x, top + topH);
        grad.addColorStop(0, shade(theme.concrete, 0.18));
        grad.addColorStop(0.5, shade(theme.concrete, 0.02));
        grad.addColorStop(1, shade(theme.concrete, -0.14));
        g.fillStyle = grad;
        g.fillRect(s.x + 4, top, s.w - 8, topH);
        g.globalAlpha = 0.35;
        g.fillStyle = g.createPattern(noiseTile, 'repeat');
        g.fillRect(s.x + 4, top, s.w - 8, topH);
        g.globalAlpha = 1;

        // 伸缩缝与车道线
        g.strokeStyle = 'rgba(0,0,0,0.3)';
        g.lineWidth = 3;
        for (let x = s.x + 120; x < s.x + s.w; x += 180) {
            g.beginPath(); g.moveTo(x, top + 4); g.lineTo(x, top + topH - 4); g.stroke();
        }
        g.strokeStyle = 'rgba(220,210,175,0.22)';
        g.lineWidth = 3;
        g.setLineDash([34, 30]);
        g.beginPath();
        g.moveTo(s.x + 20, top + topH / 2);
        g.lineTo(s.x + s.w - 20, top + topH / 2);
        g.stroke();
        g.setLineDash([]);
        g.strokeStyle = 'rgba(220,210,175,0.12)';
        g.beginPath();
        g.moveTo(s.x + 20, top + 20); g.lineTo(s.x + s.w - 20, top + 20);
        g.moveTo(s.x + 20, top + topH - 20); g.lineTo(s.x + s.w - 20, top + topH - 20);
        g.stroke();

        // 护栏
        g.fillStyle = 'rgba(30,36,34,0.45)';
        g.fillRect(s.x + 4, top + 2, s.w - 8, 5);
        g.fillRect(s.x + 4, top + topH - 7, s.w - 8, 5);

        // 坍塌口
        if (s.collapse) {
            const cx = s.x + s.w * 0.43;
            const cy = s.y + 100;
            const cw = s.w * 0.3;
            const ch = s.h - 150;
            g.fillStyle = '#0b0c0a';
            g.beginPath();
            g.moveTo(cx - cw / 2, cy);
            g.lineTo(cx - cw * 0.28, cy + ch * 0.22);
            g.lineTo(cx - cw * 0.38, cy + ch * 0.72);
            g.lineTo(cx - cw * 0.05, cy + ch);
            g.lineTo(cx + cw * 0.36, cy + ch * 0.78);
            g.lineTo(cx + cw * 0.44, cy + ch * 0.25);
            g.lineTo(cx + cw * 0.18, cy);
            g.closePath();
            g.fill();
            // 断口钢筋
            g.strokeStyle = '#5b4a3a';
            g.lineWidth = 2;
            for (let i = 0; i < 10; i++) {
                const t = i / 9;
                const sx = cx - cw * 0.45 + cw * 0.9 * t;
                g.beginPath();
                g.moveTo(sx, cy + 8 + (i % 3) * 10);
                g.lineTo(sx + (i % 2 ? -14 : 12), cy + 34 + (i % 4) * 12);
                g.stroke();
            }
            g.fillStyle = 'rgba(70,64,52,0.9)';
            for (let i = 0; i < 14; i++) {
                const rx = cx - cw / 2 + Math.random() * cw;
                const ry = cy + ch * 0.55 + Math.random() * ch * 0.45;
                g.fillRect(rx, ry, 8 + Math.random() * 20, 5 + Math.random() * 10);
            }
            emissives.push({ t: 'hole', x: cx, y: cy + ch / 2, w: cw, h: ch, color: '#000', power: 0 });
        }

        // 墙面涂鸦
        g.globalAlpha = 0.3;
        g.fillStyle = theme.rust;
        g.font = '700 28px sans-serif';
        g.fillText('NO EXIT', s.x + s.w * 0.7, s.y + s.h - 10);
        g.globalAlpha = 1;
        g.restore();
    }

    function paintGlobalShadows(g) {
        g.save();
        g.shadowColor = 'rgba(0,0,0,0.55)';
        g.shadowBlur = 30;
        g.shadowOffsetX = 18;
        g.shadowOffsetY = 24;
        g.fillStyle = 'rgba(0,0,0,0.18)';
        for (const s of solids) {
            if (s.kind === 'fence') { continue; }
            g.fillRect(s.x, s.y, s.w, s.h);
        }
        for (const c of circleSolids) {
            if (c.r < 18) { continue; }
            g.beginPath(); g.arc(c.x, c.y, c.r, 0, TAU); g.fill();
        }
        g.restore();
    }

    function paintCables(g) {
        const street = lights.filter((l) => l.t === 'street' || l.t === 'flood');
        g.save();
        g.lineCap = 'round';
        for (let i = 0; i < street.length; i++) {
            for (let j = i + 1; j < street.length; j++) {
                const a = street[i], b = street[j];
                const d = dist(a.x, a.y, b.x, b.y);
                if (d > 560 || d < 80) { continue; }
                const sag = Math.min(38, d * 0.08);
                g.strokeStyle = 'rgba(10,12,11,0.20)';
                g.lineWidth = 1.2;
                g.beginPath();
                g.moveTo(a.x + 3, a.y + 8);
                g.quadraticCurveTo((a.x + b.x) / 2 + 4, (a.y + b.y) / 2 + sag + 12, b.x + 3, b.y + 8);
                g.stroke();
                g.strokeStyle = 'rgba(12,14,13,0.30)';
                g.beginPath();
                g.moveTo(a.x, a.y - 2);
                g.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + sag, b.x, b.y - 2);
                g.stroke();
            }
        }
        g.restore();
    }

    function paintGraffiti(g) {
        const rand = seeded(levelIndex * 733 + 19);
        const colors = ['#d9563f', '#4fb6a8', '#d1a24a', '#8f6fc0', '#5f9bc7', '#c4547e'];
        const tags = ['NO FUTURE', 'RUST', 'WASTED', 'KEEP OUT', 'DEAD END', 'RUN', 'LZ-06', 'NO HOPE'];
        for (const b of buildings) {
            if (b.style === 'tent') { continue; }
            const count = 1 + Math.floor(rand() * 2);
            for (let i = 0; i < count; i++) {
                const c = colors[Math.floor(rand() * colors.length)];
                const x = b.x + 30 + rand() * Math.max(10, b.w - 200);
                const y = b.y + b.h - 30 - rand() * 18;
                g.save();
                g.globalAlpha = 0.24 + rand() * 0.18;
                g.strokeStyle = c;
                g.lineWidth = 2 + rand() * 3;
                g.lineCap = 'round';
                g.beginPath();
                let cx = x;
                g.moveTo(cx, y);
                for (let k = 0; k < 5; k++) {
                    cx += 8 + rand() * 15;
                    g.lineTo(cx, y + (rand() - 0.5) * 18);
                }
                g.stroke();
                if (rand() < 0.55) {
                    g.fillStyle = c;
                    g.font = '800 ' + (12 + Math.floor(rand() * 9)) + 'px "PingFang SC","Microsoft YaHei",sans-serif';
                    g.textAlign = 'left';
                    g.fillText(tags[Math.floor(rand() * tags.length)], x + 8, y - 12);
                }
                g.restore();
            }
            // 建筑脚下的地面喷漆
            if (rand() < 0.55) {
                g.save();
                g.globalAlpha = 0.10;
                g.fillStyle = colors[Math.floor(rand() * colors.length)];
                g.font = '900 ' + (26 + Math.floor(rand() * 22)) + 'px "PingFang SC","Microsoft YaHei",sans-serif';
                g.translate(b.x + 30 + rand() * 120, b.y + b.h + 45 + rand() * 60);
                g.rotate((rand() - 0.5) * 0.3);
                g.fillText(tags[Math.floor(rand() * tags.length)], 0, 0);
                g.restore();
            }
        }
        for (const w of walls) {
            if (w.w < 160) { continue; }
            const c = colors[Math.floor(rand() * colors.length)];
            g.save();
            g.globalAlpha = 0.22;
            g.strokeStyle = c;
            g.lineWidth = 3;
            g.beginPath();
            let x = w.x + 20 + rand() * (w.w - 160);
            const y = w.y + w.h / 2 + (rand() - 0.5) * 6;
            g.moveTo(x, y);
            for (let k = 0; k < 4; k++) {
                x += 12 + rand() * 18;
                g.lineTo(x, y + (rand() - 0.5) * 12);
            }
            g.stroke();
            g.restore();
        }
    }

    function paintEdgeWeeds(g) {
        const rand = seeded(levelIndex * 617 + 51);
        const green = theme.grass;
        const tuft = (x, y) => {
            if (rand() < 0.4) { return; }
            g.strokeStyle = rgba(green, 0.28 + rand() * 0.22);
            g.lineWidth = 1;
            for (let i = 0; i < 3; i++) {
                g.beginPath();
                g.moveTo(x, y);
                g.lineTo(x + (rand() - 0.5) * 10, y - 3 - rand() * 7);
                g.stroke();
            }
        };
        for (const b of buildings) {
            for (let i = 0; i < 10; i++) {
                tuft(b.x + 6 + rand() * (b.w - 12), b.y + b.h + 2 + rand() * 8);
            }
        }
        for (const f of fences) {
            for (let i = 0; i < 8; i++) {
                if (f.w > f.h) {
                    tuft(f.x + rand() * f.w, f.y + f.h + rand() * 6);
                } else {
                    tuft(f.x + f.w + rand() * 6, f.y + rand() * f.h);
                }
            }
        }
        for (const w of walls) {
            for (let i = 0; i < 8; i++) {
                tuft(w.x + rand() * w.w, w.y + w.h + rand() * 5);
            }
        }
    }

    function drawFence(g, f) {
        g.save();
        const horizontal = f.w >= f.h;
        const len = horizontal ? f.w : f.h;
        const cx = f.x + f.w / 2;
        const cy = f.y + f.h / 2;
        g.strokeStyle = 'rgba(0,0,0,0.3)';
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(f.x + 3, f.y + f.h - 2);
        g.lineTo(f.x + f.w + 3, f.y + f.h - 2);
        g.stroke();
        const step = 68;
        for (let i = 0; i <= len; i += step) {
            const px = horizontal ? f.x + i : cx;
            const py = horizontal ? cy : f.y + i;
            g.fillStyle = '#3d423d';
            g.beginPath(); g.arc(px, py, 3.5, 0, TAU); g.fill();
            g.fillStyle = 'rgba(255,255,255,0.15)';
            g.beginPath(); g.arc(px - 1, py - 1, 1.5, 0, TAU); g.fill();
        }
        // 网面
        g.strokeStyle = f.kind === 'razor' ? 'rgba(185,190,180,0.30)' : 'rgba(155,165,155,0.22)';
        g.lineWidth = 1;
        if (horizontal) {
            for (let x = f.x; x < f.x + f.w; x += 9) {
                g.beginPath(); g.moveTo(x, f.y + 2); g.lineTo(x + 9, f.y + f.h - 2); g.stroke();
                g.beginPath(); g.moveTo(x, f.y + f.h - 2); g.lineTo(x + 9, f.y + 2); g.stroke();
            }
        } else {
            for (let y = f.y; y < f.y + f.h; y += 9) {
                g.beginPath(); g.moveTo(f.x + 2, y); g.lineTo(f.x + f.w - 2, y + 9); g.stroke();
                g.beginPath(); g.moveTo(f.x + f.w - 2, y); g.lineTo(f.x + 2, y + 9); g.stroke();
            }
        }
        // 顶部刺丝
        if (f.kind === 'razor') {
            g.strokeStyle = 'rgba(210,214,205,0.42)';
            g.lineWidth = 1.2;
            for (let i = 0; i < len; i += 14) {
                const px = horizontal ? f.x + i : cx;
                const py = horizontal ? cy - 4 : f.y + i;
                g.beginPath();
                g.arc(px, py, 4.5, 0, TAU);
                g.stroke();
            }
        }
        g.restore();
    }

    // ============================================================ 道具
    function drawProp(g, p) {
        switch (p.t) {
            case 'car': drawVehicle(g, p, p.kind); break;
            case 'bus': drawVehicle(g, p, 'bus'); break;
            case 'truck': drawVehicle(g, p, 'truck'); break;
            case 'tanker': drawVehicle(g, p, 'tanker'); break;
            case 'humvee': drawVehicle(g, p, 'humvee'); break;
            case 'container': drawContainer(g, p); break;
            case 'crate': drawCrate(g, p); break;
            case 'cube': drawCube(g, p); break;
            case 'barrel': drawBarrel(g, p); break;
            case 'tires': drawTires(g, p); break;
            case 'tree': drawTree(g, p); break;
            case 'dumpster': drawDumpster(g, p); break;
            case 'crane': drawCrane(g, p); break;
            case 'generator': drawGenerator(g, p); break;
            case 'barrier': drawBarrier(g, p); break;
            case 'column': case 'pillar': drawColumn(g, p); break;
            case 'rubble': drawRubble(g, p); break;
            case 'fountain': drawFountain(g, p); break;
            case 'tank': drawTank(g, p); break;
            case 'planter': drawPlanter(g, p); break;
            case 'bench': drawBench(g, p); break;
            case 'cart': drawCart(g, p); break;
            case 'vending': drawVending(g, p); break;
            case 'phone': drawPhone(g, p); break;
            case 'billboard': drawBillboard(g, p); break;
            case 'canopy': drawCanopy(g, p); break;
            case 'pump': drawPump(g, p); break;
            case 'train': drawTrain(g, p); break;
            case 'ticketgate': drawTicketGate(g, p); break;
            case 'trash': drawTrash(g, p); break;
            case 'sandbag': drawSandbags(g, p); break;
            case 'watchtower': drawWatchtower(g, p); break;
            case 'tent': drawTentProp(g, p); break;
            case 'watertank': drawWaterTank(g, p); break;
            case 'pylon': drawPylon(g, p); break;
            case 'bollard': drawBollard(g, p); break;
            case 'windsock': drawWindsock(g, p); break;
            case 'subwaysign': drawSubwaySign(g, p); break;
            default: break;
        }
    }

    function drawVehicle(g, p, kind) {
        const dims = {
            bus: [238, 94], truck: [196, 84], tanker: [250, 98],
            humvee: [154, 76], sedan: [128, 58], suv: [136, 64],
            van: [142, 66], taxi: [128, 58], police: [132, 60], burnt: [128, 58]
        };
        const baseDims = dims[kind] || dims.sedan;
        const long = baseDims[0], wide = baseDims[1];
        const rot = p.rot ? Math.PI / 2 : 0;
        const burnt = kind === 'burnt' || p.kind === 'burnt';
        const palette = {
            sedan: ['#8c3d34', '#4b5b66', '#6d6a58', '#3f4d45'],
            suv: ['#45555c', '#5b4a3c', '#3d4540'],
            van: ['#6a6250', '#4c5960'],
            taxi: ['#b08a2e', '#a17325'],
            police: ['#2e3f4e'],
            truck: ['#6d5a3f', '#4a5752'],
            bus: ['#72613e'],
            humvee: ['#4d5541', '#565b4a'],
            tanker: ['#7c7b70'],
            burnt: ['#332f2b', '#403a33']
        }[kind] || ['#555'];
        const rand = seeded(Math.floor(p.x * 13 + p.y * 7));
        const color = burnt ? '#302c28' : palette[Math.floor(rand() * palette.length)];

        g.save();
        g.translate(p.x, p.y);
        g.rotate(rot);
        // 阴影
        g.fillStyle = 'rgba(0,0,0,0.42)';
        roundRect(g, -long / 2 + 12, -wide / 2 + 14, long, wide, 12);
        g.fill();

        // 轮子
        g.fillStyle = '#18191a';
        const wheelW = 18, wheelH = 11;
        const wheelY = wide / 2 - 5;
        [-1, 1].forEach((side) => {
            [-long / 2 + 23, long / 2 - 23].forEach((wx) => {
                roundRect(g, wx - wheelW / 2, side * wheelY - wheelH / 2, wheelW, wheelH, 4);
                g.fill();
            });
        });
        if (kind === 'bus' || kind === 'truck') {
            g.fillStyle = '#171819';
            [-1, 1].forEach((side) => {
                [-long / 2 + 70, long / 2 - 70].forEach((wx) => {
                    roundRect(g, wx - 11, side * wheelY - 6, 22, 12, 4);
                    g.fill();
                });
            });
        }

        // 车身
        const bodyGrad = g.createLinearGradient(0, -wide / 2, 0, wide / 2);
        bodyGrad.addColorStop(0, shade(color, burnt ? 0.12 : 0.26));
        bodyGrad.addColorStop(0.35, color);
        bodyGrad.addColorStop(1, shade(color, burnt ? -0.3 : -0.22));
        g.fillStyle = bodyGrad;
        roundRect(g, -long / 2, -wide / 2 + 4, long, wide - 8, kind === 'bus' ? 8 : 14);
        g.fill();
        g.strokeStyle = burnt ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.4)';
        g.lineWidth = 2;
        g.stroke();

        // 车顶 / 玻璃
        if (kind === 'bus') {
            g.fillStyle = burnt ? '#181715' : 'rgba(28,40,46,0.85)';
            g.fillRect(-long / 2 + 16, -wide / 2 + 14, long - 32, wide - 28);
            g.fillStyle = 'rgba(180,210,215,0.12)';
            for (let i = 0; i < 6; i++) {
                g.fillRect(-long / 2 + 24 + i * 32, -wide / 2 + 17, 22, 6);
            }
            g.fillStyle = 'rgba(255,255,255,0.08)';
            g.fillRect(-long / 2 + 12, -wide / 2 + 10, long - 24, 3);
        } else if (kind === 'tanker') {
            g.fillStyle = burnt ? '#2a2521' : '#8c8c80';
            roundRect(g, -long / 2 + 30, -wide / 2 + 10, long - 70, wide - 20, 26);
            g.fill();
            g.strokeStyle = 'rgba(30,30,28,0.5)';
            g.lineWidth = 2;
            for (let i = 0; i < 4; i++) {
                const rx = -long / 2 + 44 + i * ((long - 80) / 3);
                g.beginPath(); g.arc(rx, 0, 3, 0, TAU); g.stroke();
            }
            g.fillStyle = 'rgba(255,255,255,0.10)';
            roundRect(g, -long / 2 + 36, -wide / 2 + 13, long - 82, 5, 3);
            g.fill();
            g.fillStyle = burnt ? '#1a1816' : 'rgba(25,30,32,0.9)';
            g.fillRect(long / 2 - 36, -wide / 2 + 16, 22, wide - 32);
        } else {
            // 引擎盖、车顶、后备箱
            const hood = long * 0.26, trunk = long * 0.2, roof = long * 0.38;
            g.fillStyle = burnt ? '#262320' : shade(color, -0.08);
            g.fillRect(-long / 2 + 6, -wide / 2 + 9, hood, wide - 18);
            g.fillRect(long / 2 - trunk - 6, -wide / 2 + 9, trunk, wide - 18);
            const glassGrad = g.createLinearGradient(-long / 4, 0, long / 4, 0);
            glassGrad.addColorStop(0, burnt ? '#181615' : 'rgba(35,50,58,0.92)');
            glassGrad.addColorStop(0.5, burnt ? '#24201d' : 'rgba(58,76,84,0.95)');
            glassGrad.addColorStop(1, burnt ? '#151413' : 'rgba(25,38,46,0.92)');
            g.fillStyle = glassGrad;
            g.beginPath();
            g.moveTo(-long / 2 + hood + 4, -wide / 2 + 12);
            g.lineTo(long / 2 - trunk - 4, -wide / 2 + 12);
            g.lineTo(long / 2 - trunk - 12, wide / 2 - 12);
            g.lineTo(-long / 2 + hood + 12, wide / 2 - 12);
            g.closePath();
            g.fill();
            g.strokeStyle = 'rgba(0,0,0,0.35)';
            g.lineWidth = 2;
            g.stroke();
            // 车顶
            g.fillStyle = burnt ? '#2a2622' : shade(color, 0.10);
            roundRect(g, -long * 0.1, -wide / 2 + 15, long * 0.22, wide - 30, 5);
            g.fill();
            g.fillStyle = 'rgba(255,255,255,0.10)';
            g.fillRect(-long * 0.09, -wide / 2 + 17, long * 0.2, 3);
            // 灯
            g.fillStyle = burnt ? '#3d352c' : 'rgba(255,220,160,0.65)';
            g.fillRect(long / 2 - 8, -wide / 2 + 13, 4, 9);
            g.fillRect(long / 2 - 8, wide / 2 - 22, 4, 9);
            g.fillStyle = 'rgba(170,40,32,0.55)';
            g.fillRect(-long / 2 + 4, -wide / 2 + 14, 3, 8);
            g.fillRect(-long / 2 + 4, wide / 2 - 22, 3, 8);
            // 后视镜
            g.fillStyle = shade(color, -0.25);
            g.fillRect(-long / 2 + hood + 1, -wide / 2 - 3, 7, 4);
            g.fillRect(-long / 2 + hood + 1, wide / 2 - 1, 7, 4);
            if (kind === 'police' || kind === 'taxi') {
                g.fillStyle = kind === 'taxi' ? 'rgba(255,210,100,0.8)' : 'rgba(90,150,255,0.8)';
                g.fillRect(-long * 0.03, -wide / 2 + 15, 15, 5);
            }
        }

        if (burnt) {
            // 烧蚀痕迹
            const rand2 = seeded(Math.floor(p.x * 5 + p.y * 17));
            for (let i = 0; i < 10; i++) {
                g.fillStyle = 'rgba(8,7,6,' + (0.2 + rand2() * 0.3) + ')';
                g.beginPath();
                g.ellipse((rand2() - 0.5) * long * 0.8, (rand2() - 0.5) * wide * 0.7, 4 + rand2() * 14, 3 + rand2() * 8, rand2() * 3, 0, TAU);
                g.fill();
            }
        }
        // 锈斑
        const rand3 = seeded(Math.floor(p.x * 31 + p.y * 19));
        for (let i = 0; i < 5; i++) {
            g.fillStyle = 'rgba(120,62,32,' + (0.18 + rand3() * 0.2) + ')';
            g.beginPath();
            g.ellipse((rand3() - 0.5) * long * 0.8, (rand3() - 0.5) * wide * 0.6, 3 + rand3() * 8, 2 + rand3() * 4, 0, 0, TAU);
            g.fill();
        }
        g.restore();
    }

    function drawContainer(g, p) {
        const x = p.x - p.w / 2, y = p.y - p.h / 2;
        g.save();
        g.fillStyle = 'rgba(0,0,0,0.35)';
        roundRect(g, x + 7, y + 8, p.w, p.h, 4);
        g.fill();
        const base = p.color;
        const grad = g.createLinearGradient(x, y, x, y + p.h);
        grad.addColorStop(0, shade(base, 0.2));
        grad.addColorStop(0.45, base);
        grad.addColorStop(1, shade(base, -0.24));
        g.fillStyle = grad;
        g.fillRect(x, y, p.w, p.h);
        g.strokeStyle = 'rgba(0,0,0,0.42)';
        g.lineWidth = 2;
        g.strokeRect(x, y, p.w, p.h);
        // 波纹
        g.strokeStyle = 'rgba(0,0,0,0.18)';
        g.lineWidth = 2;
        if (p.w >= p.h) {
            for (let sx = x + 8; sx < x + p.w - 6; sx += 13) {
                g.beginPath(); g.moveTo(sx, y + 5); g.lineTo(sx, y + p.h - 5); g.stroke();
            }
        } else {
            for (let sy = y + 8; sy < y + p.h - 6; sy += 13) {
                g.beginPath(); g.moveTo(x + 5, sy); g.lineTo(x + p.w - 5, sy); g.stroke();
            }
        }
        g.fillStyle = 'rgba(255,255,255,0.08)';
        g.fillRect(x, y, p.w, 3);
        // 箱门 / 编号
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(x + p.w - 18, y + 8, 10, p.h - 16);
        g.fillStyle = 'rgba(230,230,220,0.3)';
        g.font = '700 11px monospace';
        g.textAlign = 'left';
        g.fillText('WST-' + (Math.floor(p.x) % 900 + 100), x + 10, y + 16);
        // 锈
        for (let i = 0; i < 7; i++) {
            const rand = seeded(Math.floor(p.x + p.y * 3 + i * 47));
            g.fillStyle = 'rgba(126,68,38,' + (0.18 + rand() * 0.2) + ')';
            g.beginPath();
            g.ellipse(x + rand() * p.w, y + rand() * p.h, 4 + rand() * 12, 2 + rand() * 5, rand() * 3, 0, TAU);
            g.fill();
        }
        g.restore();
    }

    function drawCrate(g, p) {
        const s = p.size;
        const x = p.x - s / 2, y = p.y - s / 2;
        g.save();
        g.fillStyle = 'rgba(0,0,0,0.3)';
        g.fillRect(x + 4, y + 5, s, s);
        const base = '#8a6a43';
        const grad = g.createLinearGradient(x, y, x + s, y + s);
        grad.addColorStop(0, shade(base, 0.2));
        grad.addColorStop(1, shade(base, -0.24));
        g.fillStyle = grad;
        g.fillRect(x, y, s, s);
        g.strokeStyle = 'rgba(38,28,18,0.7)';
        g.lineWidth = 2;
        g.strokeRect(x, y, s, s);
        g.strokeStyle = 'rgba(50,38,24,0.5)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x + 3, y + 3); g.lineTo(x + s - 3, y + s - 3);
        g.moveTo(x + s - 3, y + 3); g.lineTo(x + 3, y + s - 3);
        g.stroke();
        g.fillStyle = 'rgba(220,205,170,0.22)';
        g.fillRect(x + 4, y + s - 8, s - 8, 4);
        g.restore();
    }

    function drawCube(g, p) {
        const x = p.x - 31, y = p.y - 31;
        g.save();
        g.fillStyle = 'rgba(0,0,0,0.32)';
        g.fillRect(x + 5, y + 6, 62, 62);
        g.fillStyle = '#4c3c30';
        g.fillRect(x, y, 62, 62);
        const rand = seeded(Math.floor(p.x * 13 + p.y));
        for (let i = 0; i < 24; i++) {
            g.fillStyle = ['#7e4132', '#4b5760', '#6d6248', '#3b3630'][Math.floor(rand() * 4)];
            g.fillRect(x + 3 + rand() * 54, y + 3 + rand() * 54, 4 + rand() * 9, 2 + rand() * 5);
        }
        g.strokeStyle = 'rgba(10,8,6,0.7)';
        g.lineWidth = 2;
        g.strokeRect(x, y, 62, 62);
        g.strokeStyle = 'rgba(160,150,130,0.18)';
        g.beginPath();
        g.moveTo(x + 6, y + 6); g.lineTo(x + 56, y + 56);
        g.stroke();
        g.restore();
    }

    function drawBarrel(g, p) {
        g.save();
        g.fillStyle = 'rgba(0,0,0,0.32)';
        g.beginPath(); g.ellipse(p.x + 4, p.y + 5, 19, 17, 0, 0, TAU); g.fill();
        const grad = g.createRadialGradient(p.x - 6, p.y - 7, 2, p.x, p.y, 20);
        grad.addColorStop(0, p.burning ? '#8a3b2a' : '#7c5a3c');
        grad.addColorStop(1, p.burning ? '#241812' : '#3f2f22');
        g.fillStyle = grad;
        g.beginPath(); g.arc(p.x, p.y, 18, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(20,14,10,0.65)';
        g.lineWidth = 2;
        g.beginPath(); g.arc(p.x, p.y, 18, 0, TAU); g.stroke();
        g.strokeStyle = 'rgba(210,190,150,0.18)';
        g.beginPath(); g.arc(p.x, p.y, 11, 0, TAU); g.stroke();
        g.fillStyle = 'rgba(20,16,12,0.5)';
        g.beginPath(); g.arc(p.x, p.y, 5, 0, TAU); g.fill();
        if (!p.burning) {
            g.fillStyle = 'rgba(210,190,150,0.2)';
            g.font = '700 8px monospace';
            g.textAlign = 'center';
            g.fillText('FUEL', p.x, p.y + 3);
        }
        g.restore();
    }

    function drawTires(g, p) {
        g.save();
        g.fillStyle = 'rgba(0,0,0,0.28)';
        g.beginPath(); g.ellipse(p.x + 6, p.y + 7, 28, 18, 0, 0, TAU); g.fill();
        for (let i = 0; i < p.n; i++) {
            const ox = (i % 3) * 11 - 11;
            const oy = Math.floor(i / 3) * 9 - 4;
            g.fillStyle = '#191a1b';
            g.beginPath(); g.ellipse(p.x + ox, p.y + oy, 20, 14, 0, 0, TAU); g.fill();
            g.strokeStyle = 'rgba(80,82,78,0.35)';
            g.lineWidth = 2;
            g.beginPath(); g.ellipse(p.x + ox, p.y + oy, 13, 9, 0, 0, TAU); g.stroke();
            g.fillStyle = '#2a2b2b';
            g.beginPath(); g.ellipse(p.x + ox, p.y + oy, 6, 4, 0, 0, TAU); g.fill();
        }
        g.restore();
    }

    function drawTree(g, p) {
        g.save();
        g.fillStyle = 'rgba(0,0,0,0.3)';
        g.beginPath(); g.ellipse(p.x + 9, p.y + 10, p.r * 1.1, p.r * 0.75, 0, 0, TAU); g.fill();
        const rand = seeded(Math.floor(p.x * 7 + p.y * 11));
        g.strokeStyle = '#3b3226';
        g.lineCap = 'round';
        for (let i = 0; i < 7; i++) {
            const a = rand() * TAU;
            const len = p.r * (0.6 + rand() * 0.9);
            g.lineWidth = 2 + rand() * 3;
            g.beginPath();
            g.moveTo(p.x, p.y);
            g.quadraticCurveTo(
                p.x + Math.cos(a) * len * 0.5, p.y + Math.sin(a) * len * 0.5,
                p.x + Math.cos(a + 0.5) * len, p.y + Math.sin(a + 0.5) * len
            );
            g.stroke();
        }
        g.fillStyle = '#2b241b';
        g.beginPath(); g.arc(p.x, p.y, 5, 0, TAU); g.fill();
        // 少量枯叶
        for (let i = 0; i < 18; i++) {
            const a = rand() * TAU, d = p.r * rand();
            g.fillStyle = 'rgba(120,104,58,0.35)';
            g.fillRect(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 2, 2);
        }
        g.restore();
    }

    function drawDumpster(g, p) {
        const w = p.w, h = p.h;
        const x = p.x - w / 2, y = p.y - h / 2;
        g.save();
        g.fillStyle = 'rgba(0,0,0,0.3)';
        roundRect(g, x + 6, y + 7, w, h, 5);
        g.fill();
        const grad = g.createLinearGradient(x, y, x, y + h);
        grad.addColorStop(0, '#4f5c52');
        grad.addColorStop(1, '#2c352f');
        g.fillStyle = grad;
        roundRect(g, x, y, w, h, 4);
        g.fill();
        g.strokeStyle = 'rgba(10,14,12,0.6)';
        g.lineWidth = 2;
        g.stroke();
        g.strokeStyle = 'rgba(190,200,180,0.12)';
        g.beginPath();
        g.moveTo(x + 6, y + 6); g.lineTo(x + w - 6, y + 6);
        g.stroke();
        g.fillStyle = 'rgba(10,14,12,0.35)';
        if (p.rot) {
            g.fillRect(x + 5, y + h / 2 - 2, w - 10, 4);
        } else {
            g.fillRect(x + w / 2 - 2, y + 5, 4, h - 10);
        }
        g.fillStyle = 'rgba(210,180,100,0.16)';
        g.fillRect(x + 8, y + h - 12, w * 0.3, 5);
        g.restore();
    }

    function drawCrane(g, p) {
        const rand = seeded(Math.floor(p.x + p.y));
        g.save();
        // 长臂投影
        g.strokeStyle = 'rgba(0,0,0,0.26)';
        g.lineWidth = 20;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(p.x + 30, p.y + 20);
        g.lineTo(p.x + 300, p.y - 80);
        g.stroke();
        // 基座
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.beginPath(); g.ellipse(p.x + 6, p.y + 8, 46, 32, 0, 0, TAU); g.fill();
        g.fillStyle = '#4a4a40';
        g.beginPath(); g.arc(p.x, p.y, 42, 0, TAU); g.fill();
        g.fillStyle = '#5f6052';
        g.beginPath(); g.arc(p.x, p.y, 32, 0, TAU); g.fill();
        g.strokeStyle = '#2c302a';
        g.lineWidth = 3;
        for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 2 + 0.4;
            g.beginPath();
            g.moveTo(p.x + Math.cos(a) * 16, p.y + Math.sin(a) * 16);
            g.lineTo(p.x + Math.cos(a) * 40, p.y + Math.sin(a) * 40);
            g.stroke();
        }
        // 吊臂
        g.strokeStyle = '#6c6a58';
        g.lineWidth = 12;
        g.beginPath();
        g.moveTo(p.x + 10, p.y);
        g.lineTo(p.x + 280, p.y - 78);
        g.stroke();
        g.strokeStyle = 'rgba(20,20,16,0.5)';
        g.lineWidth = 2;
        for (let i = 0; i < 10; i++) {
            const t = i / 9;
            const ax = p.x + 10 + 270 * t;
            const ay = p.y - 78 * t;
            g.beginPath();
            g.moveTo(ax, ay - 5);
            g.lineTo(ax + 8, ay + 5);
            g.stroke();
        }
        // 吊索与磁铁
        g.strokeStyle = 'rgba(30,30,26,0.7)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(p.x + 260, p.y - 68);
        g.lineTo(p.x + 260, p.y + 6);
        g.stroke();
        g.fillStyle = '#4b4b44';
        g.beginPath(); g.arc(p.x + 260, p.y + 16, 16, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.12)';
        g.beginPath(); g.arc(p.x + 256, p.y + 11, 6, 0, TAU); g.fill();
        // 控制室
        g.fillStyle = '#54564a';
        g.fillRect(p.x - 18, p.y - 52, 42, 34);
        g.fillStyle = 'rgba(210,210,180,0.18)';
        g.fillRect(p.x - 12, p.y - 47, 26, 14);
        g.restore();
    }

    function drawGenerator(g, p) {
        g.save();
        g.fillStyle = 'rgba(0,0,0,0.32)';
        g.fillRect(p.x - 46, p.y - 22, 96, 60);
        g.fillStyle = '#5d5a48';
        roundRect(g, p.x - 48, p.y - 30, 96, 60, 4);
        g.fill();
        g.fillStyle = '#454337';
        g.fillRect(p.x - 42, p.y - 22, 84, 20);
        g.strokeStyle = 'rgba(0,0,0,0.4)';
        g.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
            g.beginPath();
            g.moveTo(p.x - 34 + i * 15, p.y - 18);
            g.lineTo(p.x - 34 + i * 15, p.y - 5);
            g.stroke();
        }
        g.fillStyle = 'rgba(255,220,140,0.4)';
        g.fillRect(p.x + 30, p.y + 6, 8, 5);
        g.fillStyle = '#32332c';
        g.beginPath(); g.arc(p.x - 22, p.y + 12, 8, 0, TAU); g.fill();
        g.restore();
    }

    function drawBarrier(g, p) {
        const x = p.x - p.w / 2, y = p.y - p.h / 2;
        g.save();
        g.fillStyle = 'rgba(0,0,0,0.3)';
        g.fillRect(x + 5, y + 6, p.w, p.h);
        const grad = g.createLinearGradient(x, y, x, y + p.h);
        grad.addColorStop(0, shade(theme.concrete, 0.18));
        grad.addColorStop(1, shade(theme.concrete, -0.25));
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(x + 8, y);
        g.lineTo(x + p.w - 8, y);
        g.lineTo(x + p.w, y + p.h);
        g.lineTo(x, y + p.h);
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.4)';
        g.lineWidth = 2;
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.1)';
        g.fillRect(x + 8, y, p.w - 16, 3);
        // 黄黑警示条纹
        g.save();
        g.beginPath();
        g.rect(x + 4, y + p.h * 0.55, p.w - 8, p.h * 0.3);
        g.clip();
        for (let i = -p.h; i < p.w; i += 26) {
            g.fillStyle = 'rgba(200,170,70,0.35)';
            g.beginPath();
            g.moveTo(x + i, y + p.h);
            g.lineTo(x + i + 13, y + p.h);
            g.lineTo(x + i + p.h + 13, y);
            g.lineTo(x + i + p.h, y);
            g.closePath();
            g.fill();
        }
        g.restore();
        g.restore();
    }

    function drawColumn(g, p) {
        const w = p.w, h = p.h;
        const x = p.x - w / 2, y = p.y - h / 2;
        g.save();
        g.fillStyle = 'rgba(0,0,0,0.4)';
        g.fillRect(x + 10, y + 12, w, h);
        g.fillStyle = shade(theme.concrete, -0.08);
        g.fillRect(x, y, w, h);
        g.fillStyle = shade(theme.concrete, 0.22);
        g.fillRect(x + 4, y + 4, w - 8, h - 8);
        g.fillStyle = shade(theme.concrete, 0.32);
        g.fillRect(x + 4, y + 4, w - 8, 4);
        g.fillStyle = shade(theme.concrete, -0.25);
        g.fillRect(x + 4, y + h - 8, w - 8, 4);
        g.strokeStyle = 'rgba(0,0,0,0.35)';
        g.lineWidth = 2;
        g.strokeRect(x, y, w, h);
        // 柱面污渍
        g.fillStyle = 'rgba(20,24,20,0.16)';
        g.fillRect(x + w * 0.2, y + 12, 4, h - 24);
        if (level.key === 'subway') {
            g.fillStyle = 'rgba(210,220,200,0.38)';
            g.fillRect(x + w * 0.55, y + h * 0.22, w * 0.28, h * 0.3);
            g.fillStyle = 'rgba(90,190,175,0.45)';
            g.fillRect(x + w * 0.58, y + h * 0.25, w * 0.22, h * 0.06);
            g.fillStyle = 'rgba(30,36,34,0.55)';
            g.fillRect(x + w * 0.58, y + h * 0.34, w * 0.2, h * 0.1);
            g.fillStyle = 'rgba(200,180,80,0.35)';
            g.fillRect(x + w * 0.08, y + h - 12, w * 0.5, 4);
        }
        g.restore();
    }

    function drawRubble(g, p) {
        const rand = seeded(Math.floor(p.x * 3 + p.y * 7));
        g.save();
        g.fillStyle = 'rgba(0,0,0,0.24)';
        g.beginPath(); g.ellipse(p.x + 6, p.y + 8, p.r, p.r * 0.58, 0, 0, TAU); g.fill();
        for (let i = 0; i < 22; i++) {
            const a = rand() * TAU;
            const d = rand() * p.r;
            const w = 6 + rand() * 24;
            const h = 4 + rand() * 12;
            g.save();
            g.translate(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * 0.6);
            g.rotate(rand() * TAU);
            g.fillStyle = rand() < 0.5 ? shade(theme.concrete, -0.2 + rand() * 0.4) : shade(theme.wall2, -0.1);
            g.fillRect(-w / 2, -h / 2, w, h);
            g.restore();
        }
        // 露出的钢筋
        g.strokeStyle = 'rgba(90,70,50,0.6)';
        g.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
            g.beginPath();
            g.moveTo(p.x - 10 + rand() * 20, p.y - 6 + rand() * 12);
            g.lineTo(p.x - 20 + rand() * 40, p.y - 18 + rand() * 30);
            g.stroke();
        }
        g.restore();
    }

    function drawFountain(g, p) {
        const r = p.r;
        g.save();
        // 外圈石台
        g.fillStyle = 'rgba(0,0,0,0.32)';
        g.beginPath(); g.ellipse(p.x + 8, p.y + 10, r + 12, r * 0.75, 0, 0, TAU); g.fill();
        g.fillStyle = shade(theme.concrete, -0.16);
        g.beginPath(); g.arc(p.x, p.y, r + 10, 0, TAU); g.fill();
        g.fillStyle = shade(theme.concrete, 0.18);
        g.beginPath(); g.arc(p.x, p.y, r + 2, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.10)';
        g.lineWidth = 2;
        g.beginPath(); g.arc(p.x, p.y, r + 6, 0, TAU); g.stroke();
        // 池水：偏青的反射色，而不是一块黑洞
        const waterGrad = g.createRadialGradient(p.x - r * 0.3, p.y - r * 0.35, 4, p.x, p.y, r);
        waterGrad.addColorStop(0, 'rgba(150,205,205,0.72)');
        waterGrad.addColorStop(0.35, 'rgba(74,130,138,0.78)');
        waterGrad.addColorStop(0.8, 'rgba(30,58,66,0.9)');
        waterGrad.addColorStop(1, 'rgba(16,30,35,0.95)');
        g.fillStyle = waterGrad;
        g.beginPath(); g.arc(p.x, p.y, r - 8, 0, TAU); g.fill();
        // 水面光圈
        g.strokeStyle = 'rgba(190,240,235,0.18)';
        g.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
            g.beginPath();
            g.ellipse(p.x - r * 0.2 + i * 9, p.y - r * 0.25 + i * 8, r * (0.2 + i * 0.13), r * (0.08 + i * 0.04), 0.25, 0, TAU);
            g.stroke();
        }
        // 中心底座与雕塑
        g.fillStyle = 'rgba(20,30,32,0.55)';
        g.beginPath(); g.arc(p.x, p.y, 24, 0, TAU); g.fill();
        g.fillStyle = shade(theme.concrete, 0.05);
        g.beginPath(); g.arc(p.x, p.y, 18, 0, TAU); g.fill();
        g.fillStyle = 'rgba(36,48,46,0.9)';
        g.beginPath(); g.arc(p.x - 2, p.y - 2, 10, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(170,200,190,0.35)';
        g.lineWidth = 2;
        g.beginPath(); g.arc(p.x - 2, p.y - 2, 12, Math.PI * 0.1, Math.PI * 1.3); g.stroke();
        // 四股水柱
        g.strokeStyle = 'rgba(200,245,240,0.32)';
        g.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
            const a = i / 4 * TAU + 0.4;
            g.beginPath();
            g.moveTo(p.x + Math.cos(a) * 12, p.y + Math.sin(a) * 12);
            g.quadraticCurveTo(p.x + Math.cos(a) * 42, p.y + Math.sin(a) * 42, p.x + Math.cos(a) * (r - 20), p.y + Math.sin(a) * (r - 20));
            g.stroke();
        }
        // 漂浮落叶
        for (let i = 0; i < 8; i++) {
            const a = i * 2.2;
            g.fillStyle = 'rgba(150,140,80,0.3)';
            g.save();
            g.translate(p.x + Math.cos(a) * r * 0.55, p.y + Math.sin(a) * r * 0.5);
            g.rotate(a);
            g.fillRect(-3, -1.5, 6, 3);
            g.restore();
        }
        emissives.push({ t: 'sign', x: p.x, y: p.y, w: 40, h: 40, color: '#6fd8d0', power: 0.16 });
        g.restore();
    }

    function drawTank(g, p) {
        const r = p.r;
        g.save();
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.beginPath(); g.ellipse(p.x + 7, p.y + 9, r + 4, r * 0.8, 0, 0, TAU); g.fill();
        const grad = g.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, 2, p.x, p.y, r);
        grad.addColorStop(0, '#a7a18e');
        grad.addColorStop(0.6, '#79745f');
        grad.addColorStop(1, '#464436');
        g.fillStyle = grad;
        g.beginPath(); g.arc(p.x, p.y, r, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(30,30,24,0.6)';
        g.lineWidth = 3;
        g.beginPath(); g.arc(p.x, p.y, r, 0, TAU); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.12)';
        g.lineWidth = 2;
        g.beginPath(); g.arc(p.x, p.y, r - 8, 0, TAU); g.stroke();
        g.fillStyle = '#4d4a3c';
        g.beginPath(); g.arc(p.x, p.y, r * 0.22, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(210,190,150,0.25)';
        g.beginPath(); g.moveTo(p.x - r * 0.3, p.y); g.lineTo(p.x + r * 0.3, p.y); g.stroke();
        g.restore();
    }

    function drawPlanter(g, p) {
        g.save();
        g.fillStyle = 'rgba(0,0,0,0.28)';
        g.beginPath(); g.ellipse(p.x + 4, p.y + 5, p.r + 3, p.r * 0.8, 0, 0, TAU); g.fill();
        g.fillStyle = shade(theme.concrete, 0.12);
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
        g.fillStyle = '#2d392b';
        g.beginPath(); g.arc(p.x, p.y, p.r - 5, 0, TAU); g.fill();
        const rand = seeded(Math.floor(p.x + p.y * 5));
        for (let i = 0; i < 12; i++) {
            const a = rand() * TAU, d = (p.r - 8) * rand();
            g.strokeStyle = 'rgba(90,115,72,0.5)';
            g.lineWidth = 2;
            g.beginPath();
            g.moveTo(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
            g.lineTo(p.x + Math.cos(a) * (d + 6), p.y + Math.sin(a) * (d + 6) - 4);
            g.stroke();
        }
        g.restore();
    }

    function drawBench(g, p) {
        g.save();
        g.translate(p.x, p.y);
        if (p.rot) { g.rotate(Math.PI / 2); }
        g.fillStyle = 'rgba(0,0,0,0.3)';
        g.fillRect(-52, -12, 104, 30);
        g.fillStyle = '#5b4b38';
        g.fillRect(-48, -16, 96, 26);
        g.fillStyle = '#7b654b';
        for (let i = 0; i < 4; i++) {
            g.fillRect(-46, -14 + i * 6, 92, 3);
        }
        g.fillStyle = '#363a34';
        g.fillRect(-44, -20, 6, 8);
        g.fillRect(38, -20, 6, 8);
        g.restore();
    }

    function drawCart(g, p) {
        g.save();
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(p.x - 20 + 3, p.y - 14 + 4, 46, 34);
        g.strokeStyle = 'rgba(180,185,180,0.6)';
        g.lineWidth = 2;
        g.strokeRect(p.x - 20, p.y - 14, 40, 28);
        for (let i = 0; i < 3; i++) {
            g.beginPath();
            g.moveTo(p.x - 16, p.y - 9 + i * 9);
            g.lineTo(p.x + 16, p.y - 9 + i * 9);
            g.stroke();
        }
        g.beginPath();
        g.moveTo(p.x + 20, p.y - 10);
        g.lineTo(p.x + 30, p.y);
        g.lineTo(p.x + 20, p.y + 10);
        g.stroke();
        g.fillStyle = '#222';
        g.beginPath(); g.arc(p.x - 14, p.y + 16, 4, 0, TAU); g.fill();
        g.beginPath(); g.arc(p.x + 14, p.y + 16, 4, 0, TAU); g.fill();
        g.restore();
    }

    function drawVending(g, p) {
        g.save();
        g.fillStyle = 'rgba(0,0,0,0.3)';
        g.fillRect(p.x - p.w / 2 + 4, p.y - p.h / 2 + 5, p.w, p.h);
        g.fillStyle = '#3a4750';
        roundRect(g, p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, 3);
        g.fill();
        g.fillStyle = 'rgba(120,220,200,0.25)';
        g.fillRect(p.x - p.w / 2 + 5, p.y - p.h / 2 + 5, p.w - 10, p.h - 10);
        g.fillStyle = 'rgba(220,240,235,0.25)';
        for (let i = 0; i < 4; i++) {
            g.fillRect(p.x - p.w / 2 + 7, p.y - p.h / 2 + 9 + i * 11, p.w - 14, 3);
        }
        g.strokeStyle = 'rgba(0,0,0,0.5)';
        g.lineWidth = 2;
        g.strokeRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
        emissives.push({ t: 'sign', x: p.x, y: p.y, w: p.w, h: p.h, color: '#7fe8d4', power: 0.35 });
        g.restore();
    }

    function drawPhone(g, p) {
        g.save();
        g.fillStyle = 'rgba(0,0,0,0.3)';
        g.fillRect(p.x - 15, p.y - 12, 38, 34);
        g.fillStyle = '#3f4a4a';
        g.fillRect(p.x - 18, p.y - 18, 36, 36);
        g.fillStyle = 'rgba(160,210,210,0.22)';
        g.fillRect(p.x - 13, p.y - 13, 26, 26);
        g.strokeStyle = 'rgba(0,0,0,0.5)';
        g.lineWidth = 2;
        g.strokeRect(p.x - 18, p.y - 18, 36, 36);
        g.restore();
    }

    function drawBillboard(g, p) {
        const x = p.x - p.w / 2;
        const y = p.y;
        const boardH = 54;
        g.save();
        // 投影：从牌面往右下拖长
        g.fillStyle = 'rgba(0,0,0,0.32)';
        g.beginPath();
        g.moveTo(x + 18, y + 20);
        g.lineTo(x + p.w + 22, y + 20);
        g.lineTo(x + p.w + 44, y + 92);
        g.lineTo(x + 40, y + 92);
        g.closePath();
        g.fill();
        // 支腿
        g.fillStyle = '#343a33';
        g.fillRect(x + 28, y + 18, 10, 62);
        g.fillRect(x + p.w - 42, y + 18, 10, 62);
        g.fillStyle = 'rgba(255,255,255,0.08)';
        g.fillRect(x + 28, y + 18, 2, 62);
        g.fillRect(x + p.w - 42, y + 18, 2, 62);
        // 牌面侧厚度
        g.fillStyle = '#2b2f28';
        g.fillRect(x, y + 10, p.w, boardH);
        // 牌面
        const grad = g.createLinearGradient(x, y, x, y + boardH);
        grad.addColorStop(0, '#7b735c');
        grad.addColorStop(0.4, '#5c5748');
        grad.addColorStop(1, '#3d3b32');
        g.fillStyle = grad;
        g.fillRect(x + 2, y + 2, p.w - 4, boardH - 8);
        g.strokeStyle = 'rgba(15,14,10,0.6)';
        g.lineWidth = 2;
        g.strokeRect(x + 2, y + 2, p.w - 4, boardH - 8);
        g.fillStyle = 'rgba(255,240,200,0.10)';
        g.fillRect(x + 5, y + 5, p.w - 10, 2);
        // 残破广告纸 / 锈斑
        const rand = seeded(Math.floor(p.x + p.y * 3));
        g.fillStyle = 'rgba(40,38,30,0.28)';
        for (let i = 0; i < 6; i++) {
            g.beginPath();
            g.ellipse(x + 20 + rand() * (p.w - 40), y + 10 + rand() * (boardH - 24), 8 + rand() * 30, 3 + rand() * 8, rand(), 0, TAU);
            g.fill();
        }
        g.fillStyle = 'rgba(139,192,180,0.18)';
        g.fillRect(x + 22, y + 12, p.w * 0.36, boardH - 28);
        g.fillStyle = 'rgba(15,17,14,0.78)';
        g.font = '800 19px "PingFang SC","Microsoft YaHei",sans-serif';
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        g.fillText('NO SCRAP · NO LIFE', x + 30, y + boardH / 2);
        g.fillStyle = 'rgba(255,190,110,0.35)';
        g.font = '700 10px monospace';
        g.fillText('SALVAGE  /  ZONE 01', x + 32, y + boardH - 14);
        // 灯管
        g.fillStyle = 'rgba(255,210,140,0.25)';
        g.fillRect(x + 8, y + boardH - 4, p.w - 16, 2);
        g.restore();
    }

    function drawCanopy(g, p) {
        const x = p.x - p.w / 2, y = p.y - p.h / 2;
        g.save();
        // 顶棚投下的整块阴影
        g.fillStyle = 'rgba(0,0,0,0.20)';
        roundRect(g, x + 24, y + 28, p.w, p.h, 6);
        g.fill();
        // 棚顶（半透明，能看见下面的泵岛）
        g.globalAlpha = 0.30;
        g.fillStyle = '#b8b09a';
        g.fillRect(x, y, p.w, p.h);
        g.globalAlpha = 1;
        // 钢结构梁
        g.strokeStyle = 'rgba(52,52,46,0.65)';
        g.lineWidth = 8;
        g.strokeRect(x + 6, y + 6, p.w - 12, p.h - 12);
        g.lineWidth = 3;
        for (let sx = x + 6; sx < x + p.w; sx += p.w / 5) {
            g.beginPath(); g.moveTo(sx, y + 8); g.lineTo(sx, y + p.h - 8); g.stroke();
        }
        for (let sy = y + 6; sy < y + p.h; sy += p.h / 3) {
            g.beginPath(); g.moveTo(x + 8, sy); g.lineTo(x + p.w - 8, sy); g.stroke();
        }
        // 红白相间的檐口
        g.fillStyle = '#9c3a30';
        g.fillRect(x, y, p.w, 12);
        g.fillRect(x, y + p.h - 12, p.w, 12);
        g.fillStyle = 'rgba(235,225,205,0.55)';
        for (let sx = x + 10; sx < x + p.w; sx += 46) {
            g.fillRect(sx, y, 18, 12);
            g.fillRect(sx, y + p.h - 12, 18, 12);
        }
        // 檐口灯带
        g.fillStyle = 'rgba(255,225,170,0.45)';
        g.fillRect(x + 16, y + 14, p.w - 32, 3);
        g.fillRect(x + 16, y + p.h - 18, p.w - 32, 3);
        // 顶棚中央的品牌字
        g.save();
        g.globalAlpha = 0.20;
        g.fillStyle = '#1e211d';
        g.font = '800 84px "PingFang SC","Microsoft YaHei",sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('FUEL', p.x, y + p.h / 2);
        g.restore();
        // 吊灯
        for (let i = 0; i < 3; i++) {
            const lx = x + p.w * (0.2 + i * 0.3);
            g.fillStyle = 'rgba(20,20,18,0.7)';
            g.fillRect(lx - 2, y + p.h * 0.32, 4, 12);
            g.fillStyle = 'rgba(255,235,190,0.6)';
            g.beginPath(); g.arc(lx, y + p.h * 0.32 + 14, 5, 0, TAU); g.fill();
        }
        g.restore();
    }

    function drawPump(g, p) {
        const x = p.x - p.w / 2, y = p.y - p.h / 2;
        g.save();
        g.fillStyle = 'rgba(0,0,0,0.32)';
        g.fillRect(x + 5, y + 7, p.w, p.h);
        g.fillStyle = '#5c5648';
        roundRect(g, x, y, p.w, p.h, 4);
        g.fill();
        g.fillStyle = '#3f4a44';
        g.fillRect(x + 8, y + 8, p.w - 16, 34);
        g.fillStyle = 'rgba(180,240,220,0.22)';
        g.fillRect(x + 12, y + 12, p.w - 24, 25);
        g.fillStyle = 'rgba(255,210,120,0.35)';
        g.font = '700 9px monospace';
        g.textAlign = 'center';
        g.fillText('00.0', p.x, y + 29);
        g.strokeStyle = 'rgba(0,0,0,0.5)';
        g.lineWidth = 2;
        g.strokeRect(x, y, p.w, p.h);
        // 油枪与软管
        g.strokeStyle = 'rgba(20,20,18,0.7)';
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(x + p.w - 6, y + 20);
        g.bezierCurveTo(x + p.w + 14, y + 40, x + p.w + 10, y + 58, x + p.w - 2, y + 64);
        g.stroke();
        g.fillStyle = '#2b2d28';
        g.fillRect(x + p.w - 10, y + 60, 12, 18);
        g.fillStyle = 'rgba(200,190,160,0.2)';
        g.fillRect(x + 6, y + 46, p.w - 12, 4);
        g.restore();
    }

    function drawTrain(g, p) {
        const x = p.x - p.w / 2, y = p.y - p.h / 2;
        const derailed = p.kind === 'derailed';
        g.save();
        g.fillStyle = 'rgba(0,0,0,0.45)';
        g.fillRect(x + 16, y + 18, p.w, p.h);
        // 车厢
        const grad = g.createLinearGradient(x, y, x, y + p.h);
        grad.addColorStop(0, '#8b908a');
        grad.addColorStop(0.35, '#6f7672');
        grad.addColorStop(1, '#464c49');
        g.fillStyle = grad;
        roundRect(g, x, y, p.w, p.h, 18);
        g.fill();
        g.strokeStyle = 'rgba(10,12,12,0.6)';
        g.lineWidth = 3;
        g.stroke();
        // 车顶
        g.fillStyle = '#7e847e';
        roundRect(g, x + 10, y + 10, p.w - 20, p.h - 20, 12);
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.25)';
        g.lineWidth = 2;
        for (let sx = x + 40; sx < x + p.w - 20; sx += 80) {
            g.beginPath(); g.moveTo(sx, y + 12); g.lineTo(sx, y + p.h - 12); g.stroke();
        }
        // 车门
        g.fillStyle = 'rgba(20,26,28,0.65)';
        for (let sx = x + 60; sx < x + p.w - 60; sx += 170) {
            g.fillRect(sx, y + 12, 46, p.h - 24);
            g.strokeStyle = 'rgba(160,170,165,0.25)';
            g.strokeRect(sx, y + 12, 46, p.h - 24);
        }
        // 车窗
        g.fillStyle = 'rgba(25,45,48,0.55)';
        for (let sx = x + 120; sx < x + p.w - 60; sx += 170) {
            g.fillRect(sx, y + 18, 28, p.h - 36);
        }
        // 锈迹与涂鸦
        const rand = seeded(Math.floor(p.x + p.y * 3));
        for (let i = 0; i < 18; i++) {
            g.fillStyle = 'rgba(120,68,38,' + (0.15 + rand() * 0.25) + ')';
            g.beginPath();
            g.ellipse(x + rand() * p.w, y + rand() * p.h, 5 + rand() * 18, 3 + rand() * 8, 0, 0, TAU);
            g.fill();
        }
        g.fillStyle = 'rgba(200,80,120,0.25)';
        g.font = '700 26px sans-serif';
        g.fillText('LAST TRAIN', x + p.w * 0.55, y + p.h / 2 + 8);
        if (derailed) {
            g.strokeStyle = 'rgba(0,0,0,0.5)';
            g.lineWidth = 4;
            g.beginPath();
            g.moveTo(x + p.w * 0.2, y + 20);
            g.lineTo(x + p.w * 0.35, y + p.h - 30);
            g.stroke();
        }
        g.restore();
    }

    function drawTicketGate(g, p) {
        g.save();
        g.translate(p.x, p.y);
        if (p.rot) { g.rotate(Math.PI / 2); }
        g.fillStyle = 'rgba(0,0,0,0.3)';
        g.fillRect(-36, -20, 78, 48);
        g.fillStyle = '#5b625f';
        g.fillRect(-40, -26, 80, 44);
        g.fillStyle = '#777f7a';
        g.fillRect(-36, -22, 72, 10);
        g.fillStyle = 'rgba(110,220,200,0.35)';
        g.fillRect(-24, -8, 22, 12);
        g.fillStyle = 'rgba(255,90,70,0.4)';
        g.fillRect(10, -8, 14, 12);
        g.strokeStyle = 'rgba(0,0,0,0.5)';
        g.lineWidth = 2;
        g.strokeRect(-40, -26, 80, 44);
        g.restore();
    }

    function drawTrash(g, p) {
        g.save();
        g.fillStyle = 'rgba(20,20,20,0.3)';
        g.beginPath(); g.ellipse(p.x + 3, p.y + 4, 20, 12, 0, 0, TAU); g.fill();
        g.fillStyle = '#252a26';
        g.beginPath(); g.ellipse(p.x, p.y, 16, 11, 0.3, 0, TAU); g.fill();
        g.fillStyle = 'rgba(200,195,170,0.22)';
        g.fillRect(p.x - 12, p.y - 4, 8, 6);
        g.fillRect(p.x + 4, p.y + 2, 10, 5);
        g.restore();
    }

    function drawSandbags(g, p) {
        g.save();
        g.fillStyle = 'rgba(0,0,0,0.3)';
        g.fillRect(p.x - p.w / 2 + 5, p.y - p.h / 2 + 6, p.w, p.h);
        const cols = Math.max(2, Math.floor(p.w / 48));
        for (let i = 0; i < cols; i++) {
            for (let row = 0; row < 2; row++) {
                const bx = p.x - p.w / 2 + 12 + i * (p.w - 24) / (cols - 1 || 1);
                const by = p.y - 6 + row * 12;
                g.fillStyle = row ? '#7b7359' : '#8c8466';
                roundRect(g, bx - 23, by - 8, 46, 16, 7);
                g.fill();
                g.strokeStyle = 'rgba(40,38,28,0.35)';
                g.lineWidth = 1;
                g.stroke();
            }
        }
        g.restore();
    }

    function drawWatchtower(g, p) {
        const x = p.x - 44, y = p.y - 44;
        g.save();
        g.fillStyle = 'rgba(0,0,0,0.38)';
        g.beginPath(); g.ellipse(p.x + 22, p.y + 26, 70, 46, 0, 0, TAU); g.fill();
        // 四腿
        g.fillStyle = '#4a4d42';
        g.fillRect(x + 4, y + 16, 8, 72);
        g.fillRect(x + 76, y + 16, 8, 72);
        g.fillRect(x + 20, y + 30, 8, 58);
        g.fillRect(x + 60, y + 30, 8, 58);
        // 平台
        g.fillStyle = '#5e6253';
        g.fillRect(x, y, 88, 64);
        g.fillStyle = '#787c6a';
        g.fillRect(x + 5, y + 5, 78, 54);
        g.strokeStyle = 'rgba(20,22,18,0.5)';
        g.lineWidth = 2;
        g.strokeRect(x, y, 88, 64);
        // 栏杆
        g.strokeStyle = 'rgba(30,34,28,0.6)';
        g.lineWidth = 2;
        for (let i = 0; i <= 6; i++) {
            g.beginPath();
            g.moveTo(x + i * 14.6, y);
            g.lineTo(x + i * 14.6, y + 10);
            g.stroke();
        }
        // 沙袋与射灯
        g.fillStyle = '#81795d';
        g.fillRect(x + 10, y + 14, 26, 12);
        g.fillStyle = '#2f3531';
        g.beginPath(); g.arc(x + 68, y + 20, 8, 0, TAU); g.fill();
        g.fillStyle = 'rgba(220,235,240,0.5)';
        g.beginPath(); g.arc(x + 68, y + 20, 4, 0, TAU); g.fill();
        g.restore();
    }

    function drawTentProp(g, p) {
        const x = p.x - p.w / 2, y = p.y - p.h / 2;
        g.save();
        g.fillStyle = 'rgba(0,0,0,0.3)';
        g.fillRect(x + 8, y + 10, p.w, p.h);
        g.fillStyle = p.color;
        roundRect(g, x, y, p.w, p.h, 10);
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.35)';
        g.lineWidth = 2;
        g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.1)';
        g.beginPath();
        g.moveTo(x + 10, y + p.h / 2); g.lineTo(x + p.w - 10, y + p.h / 2);
        g.stroke();
        for (let i = 1; i < 4; i++) {
            g.beginPath();
            g.moveTo(x + p.w * i / 4, y + 6);
            g.lineTo(x + p.w * i / 4, y + p.h - 6);
            g.stroke();
        }
        g.restore();
    }

    function drawWaterTank(g, p) {
        g.save();
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.beginPath(); g.ellipse(p.x + 6, p.y + 8, p.r + 4, p.r * 0.8, 0, 0, TAU); g.fill();
        g.fillStyle = '#4d5a58';
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
        g.fillStyle = '#66736f';
        g.beginPath(); g.arc(p.x, p.y, p.r - 6, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(20,26,26,0.5)';
        g.lineWidth = 2;
        g.beginPath(); g.arc(p.x, p.y, p.r - 12, 0, TAU); g.stroke();
        g.fillStyle = '#3f4a48';
        g.beginPath(); g.arc(p.x, p.y, 8, 0, TAU); g.fill();
        g.restore();
    }

    function drawPylon(g, p) {
        const x = p.x - p.w / 2, y = p.y - 40;
        g.save();
        // 投影
        g.fillStyle = 'rgba(0,0,0,0.34)';
        g.beginPath();
        g.moveTo(x + 22, y + 26);
        g.lineTo(x + p.w + 20, y + 26);
        g.lineTo(x + p.w + 44, y + 104);
        g.lineTo(x + 44, y + 104);
        g.closePath();
        g.fill();
        // 双柱
        g.fillStyle = '#4a4c43';
        g.fillRect(x + 26, y + 46, 12, 72);
        g.fillRect(x + p.w - 40, y + 46, 12, 72);
        g.fillStyle = 'rgba(255,255,255,0.08)';
        g.fillRect(x + 26, y + 46, 3, 72);
        g.fillRect(x + p.w - 40, y + 46, 3, 72);
        // 牌面
        const grad = g.createLinearGradient(x, y, x, y + 54);
        grad.addColorStop(0, '#d9c27a');
        grad.addColorStop(0.18, '#a83f31');
        grad.addColorStop(0.82, '#7c2e25');
        grad.addColorStop(1, '#4d201b');
        g.fillStyle = grad;
        g.fillRect(x, y, p.w, 54);
        g.strokeStyle = 'rgba(15,12,8,0.7)';
        g.lineWidth = 3;
        g.strokeRect(x, y, p.w, 54);
        g.fillStyle = 'rgba(255,240,200,0.9)';
        g.font = '800 30px "PingFang SC","Microsoft YaHei",sans-serif';
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        g.fillText('FUEL', x + 20, y + 26);
        g.fillStyle = 'rgba(255,230,170,0.9)';
        g.font = '700 22px monospace';
        g.textAlign = 'right';
        g.fillText('9.99', x + p.w - 22, y + 26);
        g.fillStyle = 'rgba(20,14,10,0.72)';
        g.fillRect(x + 8, y + 38, p.w - 16, 10);
        g.fillStyle = 'rgba(255,210,140,0.6)';
        g.font = '600 8px monospace';
        g.textAlign = 'left';
        g.fillText('LAST FUEL · OPEN 24H', x + 14, y + 44);
        // 灯管
        g.fillStyle = 'rgba(255,220,160,0.35)';
        g.fillRect(x + 6, y - 3, p.w - 12, 3);
        emissives.push({ t: 'sign', x: p.x, y: y + 22, w: p.w * 0.5, h: 40, color: '#ffd27f', power: 0.55 });
        g.restore();
    }

    function drawSubwaySign(g, p) {
        const x = p.x - p.w / 2, y = p.y - 20;
        g.save();
        g.fillStyle = 'rgba(0,0,0,0.30)';
        g.fillRect(x + 14, y + 18, p.w, 30);
        g.fillStyle = '#3a4545';
        g.fillRect(x + 24, y + 28, 8, 34);
        g.fillRect(x + p.w - 32, y + 28, 8, 34);
        const grad = g.createLinearGradient(x, y, x, y + 34);
        grad.addColorStop(0, '#315d5c');
        grad.addColorStop(1, '#192f31');
        g.fillStyle = grad;
        g.fillRect(x, y, p.w, 34);
        g.strokeStyle = 'rgba(150,235,220,0.35)';
        g.lineWidth = 2;
        g.strokeRect(x, y, p.w, 34);
        g.fillStyle = 'rgba(210,255,245,0.82)';
        g.font = '700 17px "PingFang SC","Microsoft YaHei",sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(p.text, p.x, y + 18);
        g.fillStyle = 'rgba(150,235,220,0.25)';
        g.fillRect(x + 8, y + 4, p.w - 16, 2);
        emissives.push({ t: 'sign', x: p.x, y: y + 18, w: p.w, h: 32, color: '#63e0d5', power: 0.55 });
        g.restore();
    }

    function drawWindsock(g, p) {
        g.save();
        g.fillStyle = 'rgba(0,0,0,0.3)';
        g.fillRect(p.x + 4, p.y + 6, 46, 8);
        g.fillStyle = '#4a4f45';
        g.beginPath(); g.arc(p.x, p.y, 6, 0, TAU); g.fill();
        g.strokeStyle = '#5a6154';
        g.lineWidth = 3;
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x, p.y - 24); g.stroke();
        // 风向袋
        g.save();
        g.translate(p.x, p.y - 24);
        g.rotate(-0.18);
        for (let i = 0; i < 4; i++) {
            g.fillStyle = i % 2 === 0 ? '#d9663c' : '#e8ded0';
            g.beginPath();
            g.moveTo(4 + i * 12, -5);
            g.lineTo(16 + i * 12, -4);
            g.lineTo(16 + i * 12, 4);
            g.lineTo(4 + i * 12, 5);
            g.closePath();
            g.fill();
        }
        g.strokeStyle = 'rgba(20,20,16,0.4)';
        g.lineWidth = 1;
        g.strokeRect(4, -5, 48, 10);
        g.restore();
        g.restore();
    }

    function drawBollard(g, p) {
        g.save();
        g.fillStyle = 'rgba(0,0,0,0.3)';
        g.beginPath(); g.ellipse(p.x + 3, p.y + 4, 10, 7, 0, 0, TAU); g.fill();
        g.fillStyle = '#d6a72f';
        g.beginPath(); g.arc(p.x, p.y, 7, 0, TAU); g.fill();
        g.fillStyle = '#2e2c24';
        g.beginPath(); g.arc(p.x, p.y, 4, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,240,190,0.22)';
        g.beginPath(); g.arc(p.x - 2, p.y - 2, 2, 0, TAU); g.fill();
        g.restore();
    }

    // ============================================================ 灯具 / 光源实体
    function paintLightFixtures(g) {
        for (const l of lights) {
            if (l.t === 'street') { drawStreetLamp(g, l); }
            else if (l.t === 'fluoro' || l.t === 'tube') { drawTube(g, l); }
            else if (l.t === 'flood') { drawFlood(g, l); }
            else if (l.t === 'sign') { drawSignGlowBase(g, l); }
            else if (l.t === 'fire') { drawFireBase(g, l); }
            else if (l.t === 'canopy') { /* 顶棚本身由道具绘制 */ }
        }
    }

    function drawStreetLamp(g, l) {
        const dir = l.rot >= 0 ? 1 : -1;
        g.save();
        g.fillStyle = 'rgba(0,0,0,0.32)';
        g.beginPath(); g.ellipse(l.x + 8, l.y + 8, 13, 8, 0, 0, TAU); g.fill();
        g.fillStyle = '#333a36';
        g.beginPath(); g.arc(l.x, l.y, 8, 0, TAU); g.fill();
        g.fillStyle = '#5b6259';
        g.beginPath(); g.arc(l.x - 2, l.y - 2, 4, 0, TAU); g.fill();
        g.strokeStyle = '#4c534c';
        g.lineWidth = 5;
        g.beginPath();
        g.moveTo(l.x, l.y);
        g.lineTo(l.x, l.y + dir * 24);
        g.stroke();
        g.fillStyle = '#6a7166';
        g.fillRect(l.x - 8, l.y + dir * 22 - 3, 17, 7);
        g.fillStyle = 'rgba(255,232,180,0.45)';
        g.fillRect(l.x - 6, l.y + dir * 22 - 1, 13, 3);
        g.restore();
    }

    function drawTube(g, l) {
        g.save();
        g.fillStyle = 'rgba(0,0,0,0.28)';
        g.fillRect(l.x - l.w / 2 + 5, l.y + 4, l.w, 14);
        g.fillStyle = '#3f4844';
        g.fillRect(l.x - l.w / 2 - 3, l.y - 10, l.w + 6, 20);
        g.fillStyle = 'rgba(190,255,245,0.45)';
        g.fillRect(l.x - l.w / 2 + 4, l.y - 5, l.w - 8, 8);
        g.fillStyle = 'rgba(230,255,250,0.7)';
        g.fillRect(l.x - l.w / 2 + 8, l.y - 3, l.w - 16, 2);
        g.restore();
    }

    function drawFlood(g, l) {
        const rand = seeded(l.seed * 31 + 7);
        const angle = -0.7 + rand() * 0.4;
        const hx = l.x + Math.cos(angle) * 46;
        const hy = l.y + Math.sin(angle) * 46;
        g.save();
        // 长影
        g.strokeStyle = 'rgba(0,0,0,0.30)';
        g.lineWidth = 12;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(l.x + 10, l.y + 14);
        g.lineTo(hx + 24, hy + 28);
        g.stroke();
        // 基座
        g.fillStyle = '#3c423d';
        g.beginPath(); g.arc(l.x, l.y, 14, 0, TAU); g.fill();
        g.fillStyle = '#5b6259';
        g.beginPath(); g.arc(l.x - 2, l.y - 2, 8, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,230,170,0.25)';
        g.fillRect(l.x - 10, l.y + 6, 20, 3);
        // 灯杆
        g.strokeStyle = '#555c55';
        g.lineWidth = 6;
        g.beginPath(); g.moveTo(l.x, l.y); g.lineTo(hx, hy); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.1)';
        g.lineWidth = 2;
        g.beginPath(); g.moveTo(l.x - 1, l.y - 1); g.lineTo(hx - 1, hy - 1); g.stroke();
        // 灯头
        g.fillStyle = '#343a38';
        g.beginPath(); g.arc(hx, hy, 15, 0, TAU); g.fill();
        g.fillStyle = '#666e68';
        g.beginPath(); g.arc(hx - 2, hy - 2, 11, 0, TAU); g.fill();
        g.fillStyle = 'rgba(235,245,255,0.75)';
        for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 2 + 0.4;
            g.beginPath(); g.arc(hx + Math.cos(a) * 5, hy + Math.sin(a) * 5, 2.5, 0, TAU); g.fill();
        }
        g.restore();
    }

    function drawSignGlowBase(g, l) {
        // 招牌本体已画在建筑上，这里只在墙上补一个发光条
        if (!l.vertical) {
            g.save();
            g.globalAlpha = 0.18;
            g.fillStyle = l.color;
            g.fillRect(l.x - l.w / 2, l.y - 4, l.w, 8);
            g.restore();
        }
    }

    function drawFireBase(g, l) {
        g.save();
        const r = Math.min(46, l.r * 0.28);
        const grad = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, r);
        grad.addColorStop(0, 'rgba(8,6,5,0.75)');
        grad.addColorStop(0.5, 'rgba(20,14,10,0.45)');
        grad.addColorStop(1, 'rgba(20,14,10,0)');
        g.fillStyle = grad;
        g.beginPath(); g.ellipse(l.x, l.y, r, r * 0.8, 0, 0, TAU); g.fill();
        // 炭火
        g.fillStyle = 'rgba(120,50,24,0.4)';
        g.beginPath(); g.ellipse(l.x, l.y, r * 0.5, r * 0.35, 0, 0, TAU); g.fill();
        g.restore();
    }

    // ============================================================ 小地图底图
    function bakeMinimap() {
        const scale = 0.075;
        minimapBase = document.createElement('canvas');
        minimapBase.width = Math.max(60, Math.round(W * scale));
        minimapBase.height = Math.max(60, Math.round(H * scale));
        const g = minimapBase.getContext('2d');
        g.fillStyle = '#111819';
        g.fillRect(0, 0, minimapBase.width, minimapBase.height);
        for (const z of (level.zones || [])) {
            const t = z[0];
            if (t === 'road' || t === 'asphalt') { g.fillStyle = '#394345'; }
            else if (t === 'water') { g.fillStyle = '#1c3438'; }
            else if (t === 'grass') { g.fillStyle = '#2a3329'; }
            else if (t === 'helipad') { g.fillStyle = '#39413f'; }
            else { g.fillStyle = '#283130'; }
            g.fillRect(z[1] * scale, z[2] * scale, z[3] * scale, z[4] * scale);
        }
        g.fillStyle = 'rgba(7,10,10,0.94)';
        for (const s of solids) {
            if (s.kind === 'fence') { continue; }
            g.fillRect(s.x * scale, s.y * scale, Math.max(1, s.w * scale), Math.max(1, s.h * scale));
        }
        for (const c of circleSolids) {
            g.beginPath();
            g.arc(c.x * scale, c.y * scale, Math.max(1, c.r * scale), 0, TAU);
            g.fill();
        }
    }

    // ============================================================ 碰撞与移动
    function resolveCircleRect(actor, s, r) {
        const nx = clamp(actor.x, s.x, s.x + s.w);
        const ny = clamp(actor.y, s.y, s.y + s.h);
        let dx = actor.x - nx;
        let dy = actor.y - ny;
        const d2 = dx * dx + dy * dy;
        if (d2 >= r * r) { return false; }
        if (d2 > 0.0001) {
            const d = Math.sqrt(d2);
            const push = r - d;
            actor.x += (dx / d) * push;
            actor.y += (dy / d) * push;
        } else {
            // 圆心在矩形内：朝最近的一条边挤出去
            const left = actor.x - s.x;
            const right = s.x + s.w - actor.x;
            const top = actor.y - s.y;
            const bottom = s.y + s.h - actor.y;
            const m = Math.min(left, right, top, bottom);
            if (m === left) { actor.x = s.x - r; }
            else if (m === right) { actor.x = s.x + s.w + r; }
            else if (m === top) { actor.y = s.y - r; }
            else { actor.y = s.y + s.h + r; }
        }
        return true;
    }

    function resolveCircleCircle(actor, c, r) {
        const dx = actor.x - c.x;
        const dy = actor.y - c.y;
        const min = r + c.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) { return false; }
        const d = Math.sqrt(d2) || 0.001;
        actor.x += (dx / d) * (min - d);
        actor.y += (dy / d) * (min - d);
        return true;
    }

    function moveActor(actor, dx, dy, r, collide) {
        const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 5));
        const sx = dx / steps, sy = dy / steps;
        for (let i = 0; i < steps; i++) {
            actor.x += sx;
            if (collide !== false) {
                for (const s of solids) {
                    if (resolveCircleRect(actor, s, r)) { actor.hitWall = true; }
                }
                for (const c of circleSolids) {
                    if (resolveCircleCircle(actor, c, r)) { actor.hitWall = true; }
                }
            }
            actor.y += sy;
            if (collide !== false) {
                for (const s of solids) {
                    if (resolveCircleRect(actor, s, r)) { actor.hitWall = true; }
                }
                for (const c of circleSolids) {
                    if (resolveCircleCircle(actor, c, r)) { actor.hitWall = true; }
                }
            }
        }
        actor.x = clamp(actor.x, r + 4, W - r - 4);
        actor.y = clamp(actor.y, r + 4, H - r - 4);
    }

    function lineBlocked(x1, y1, x2, y2) {
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.hypot(dx, dy);
        const steps = Math.max(2, Math.ceil(len / 16));
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const px = x1 + dx * t, py = y1 + dy * t;
            for (const s of solids) {
                if (px > s.x && px < s.x + s.w && py > s.y && py < s.y + s.h) { return true; }
            }
            for (const c of circleSolids) {
                const ddx = px - c.x, ddy = py - c.y;
                if (ddx * ddx + ddy * ddy < c.r * c.r) { return true; }
            }
        }
        return false;
    }

    function segmentCircleHit(x1, y1, x2, y2, cx, cy, cr) {
        const dx = x2 - x1, dy = y2 - y1;
        const fx = x1 - cx, fy = y1 - cy;
        const a = dx * dx + dy * dy;
        if (a < 0.0001) { return fx * fx + fy * fy <= cr * cr ? 0 : -1; }
        const b = 2 * (fx * dx + fy * dy);
        const c = fx * fx + fy * fy - cr * cr;
        const disc = b * b - 4 * a * c;
        if (disc < 0) { return -1; }
        const sq = Math.sqrt(disc);
        const t1 = (-b - sq) / (2 * a);
        const t2 = (-b + sq) / (2 * a);
        if (t1 >= 0 && t1 <= 1) { return t1; }
        if (t2 >= 0 && t2 <= 1) { return t2; }
        return -1;
    }

    // ============================================================ 玩家
    function curWeapon() { return WEAPONS[state.current]; }
    function curSlot() { return weapons[state.current]; }

    function aimWorldAngle() {
        if (isTouch) {
            if (Math.abs(input.aimX) + Math.abs(input.aimY) > 0.18) {
                return Math.atan2(input.aimY, input.aimX);
            }
            if (Math.abs(input.moveX) + Math.abs(input.moveY) > 0.15) {
                return Math.atan2(input.moveY, input.moveX);
            }
            return player.angle;
        }
        if (!pointer.active) { return player.angle; }
        const dx = pointer.worldX - player.x;
        const dy = pointer.worldY - player.y;
        if (Math.abs(dx) + Math.abs(dy) < 0.5) { return player.angle; }
        return Math.atan2(dy, dx);
    }

    function nearestZombie(range, angle, cone) {
        let best = null, bestScore = Infinity;
        for (const z of zombies) {
            if (z.dead) { continue; }
            const d = dist(player.x, player.y, z.x, z.y);
            if (d > range) { continue; }
            const a = Math.atan2(z.y - player.y, z.x - player.x);
            const diff = Math.abs(angleDiff(a, angle));
            if (cone && diff > cone) { continue; }
            const score = d + diff * 80;
            if (score < bestScore) { bestScore = score; best = z; }
        }
        return best;
    }

    function updatePlayer(dt) {
        if (player.dead) { return; }

        let mx = 0, my = 0;
        if (input.left) { mx -= 1; }
        if (input.right) { mx += 1; }
        if (input.up) { my -= 1; }
        if (input.down) { my += 1; }
        if (Math.abs(input.moveX) + Math.abs(input.moveY) > 0.08) {
            mx += input.moveX; my += input.moveY;
        }
        const mag = Math.hypot(mx, my);
        if (mag > 1) { mx /= mag; my /= mag; }

        const moving = Math.abs(mx) + Math.abs(my) > 0.08;
        const sprinting = input.sprint && moving && player.stamina > 1 && player.dodge <= 0;
        let speed = sprinting ? CFG.player.sprint : CFG.player.speed;
        if (player.dodge > 0) { speed = 0; }

        // 冲刺体力
        if (sprinting) {
            player.stamina = Math.max(0, player.stamina - dt * 27);
            player.staminaDelay = 0.8;
        } else {
            player.staminaDelay = Math.max(0, player.staminaDelay - dt);
            if (player.staminaDelay <= 0) {
                player.stamina = Math.min(CFG.player.stamina, player.stamina + dt * 21);
            }
        }

        if (input.dodge && player.dodgeCool <= 0 && player.stamina > 18) {
            const ddx = moving ? mx : Math.cos(player.angle);
            const ddy = moving ? my : Math.sin(player.angle);
            player.dodge = CFG.player.dodgeTime;
            player.dodgeCool = CFG.player.dodgeCool;
            player.dodgeDir = Math.atan2(ddy, ddx);
            player.invuln = Math.max(player.invuln, 0.38);
            player.stamina = Math.max(0, player.stamina - 20);
            player.staminaDelay = 0.8;
            SFX.dodge();
            spawnDust(player.x, player.y, 8, 'rgba(190,185,160,0.5)');
            input.dodge = false;
        }

        if (player.dodge > 0) {
            player.dodge -= dt;
            const t = clamp(player.dodge / CFG.player.dodgeTime, 0, 1);
            const spd = CFG.player.dodgeSpeed * (0.45 + t * 0.55);
            player.vx = Math.cos(player.dodgeDir) * spd;
            player.vy = Math.sin(player.dodgeDir) * spd;
            if (Math.random() < 0.6) {
                particles.push({
                    kind: 'dust', x: player.x, y: player.y + 4,
                    vx: rnd(-20, 20), vy: rnd(-20, 20), life: 0.3, max: 0.3,
                    size: rnd(3, 7), color: 'rgba(190,185,160,0.28)'
                });
            }
        } else {
            const targetVx = mx * speed;
            const targetVy = my * speed;
            const accel = moving ? CFG.player.accel : CFG.player.friction;
            player.vx += clamp(targetVx - player.vx, -accel * dt, accel * dt);
            player.vy += clamp(targetVy - player.vy, -accel * dt, accel * dt);
            if (!moving) {
                const f = CFG.player.friction * dt;
                if (Math.abs(player.vx) <= f) { player.vx = 0; } else { player.vx -= Math.sign(player.vx) * f; }
                if (Math.abs(player.vy) <= f) { player.vy = 0; } else { player.vy -= Math.sign(player.vy) * f; }
            }
        }

        player.hitWall = false;
        moveActor(player, player.vx * dt, player.vy * dt, CFG.player.r, true);

        // 朝向
        let targetAngle = aimWorldAngle();
        if (isTouch && input.fire && !input.touchAim) {
            const auto = nearestZombie(620, targetAngle, 0.9);
            if (auto) { targetAngle = Math.atan2(auto.y - player.y, auto.x - player.x); }
        }
        player.angle += angleDiff(targetAngle, player.angle) * Math.min(1, dt * 18);
        if (moving) { player.moveAngle = Math.atan2(my, mx); }
        player.moving = lerp(player.moving, moving ? 1 : 0, Math.min(1, dt * 14));

        const spd = Math.hypot(player.vx, player.vy);
        player.walk += dt * (3.2 + spd * 0.028);
        player.walkAmp = lerp(player.walkAmp, clamp(spd / CFG.player.speed, 0, 1.4), Math.min(1, dt * 12));
        player.breathe += dt * 2.1;
        player.recoil = Math.max(0, player.recoil - dt * 14);
        player.muzzle = Math.max(0, player.muzzle - dt);
        player.kick = Math.max(0, player.kick - dt * 5);
        if (player.hurt > 0) { player.hurt -= dt; }
        if (player.invuln > 0) { player.invuln -= dt; }
        if (player.dodgeCool > 0) { player.dodgeCool -= dt; }
        if (player.switchT > 0) { player.switchT -= dt; }
        if (melee.cool > 0) { melee.cool -= dt; }
        if (melee.anim > 0) { melee.anim = Math.max(0, melee.anim - dt * 4.6); }
        if (damageFlash.v > 0) { damageFlash.v = Math.max(0, damageFlash.v - dt * 1.8); }
        if (hitMarker.t > 0) { hitMarker.t = Math.max(0, hitMarker.t - dt); }

        // 脚步
        if (spd > 20) {
            const half = Math.floor(player.walk / Math.PI);
            if (half !== player.stepHalf) {
                player.stepHalf = half;
                SFX.step(sprinting, half % 2 === 1);
                spawnDust(player.x, player.y + 6, 1, 'rgba(170,165,145,0.16)');
            }
        }

        // 开火 / 近战
        for (const key of WEAPON_ORDER) {
            const slot = weapons[key];
            if (slot.cool > 0) { slot.cool -= dt; }
            if (slot.reloading > 0) {
                slot.reloading -= dt;
                player.reloadT = clamp(slot.reloading / Math.max(0.001, slot.reloadTime), 0, 1);
                if (slot.reloading <= 0) {
                    slot.reloading = 0;
                    finishReload(key);
                }
            }
        }
        if (input.switchTo) {
            const target = WEAPON_ORDER[input.switchTo - 1];
            if (target) { switchWeapon(input.switchTo - 1); }
            input.switchTo = 0;
        }
        if (input.reload) {
            startReload();
            input.reload = false;
        }
        if (input.heal) {
            useMedkit();
            input.heal = false;
        }
        if (input.melee) {
            meleeAttack();
            input.melee = false;
        }
        if (input.fire || input.fireLatch) {
            fireWeapon();
            input.fireLatch = false;
        }

        // 低血量心跳
        if (player.hp > 0 && player.hp <= 30) {
            heartbeatTimer -= dt;
            if (heartbeatTimer <= 0) {
                heartbeatTimer = rnd(0.95, 1.3);
                SFX.heartbeat();
            }
        }
    }

    function ejectShell() {
        const a = player.angle + Math.PI / 2 + rnd(-0.3, 0.3);
        const px = player.x + Math.cos(player.angle) * 12;
        const py = player.y + Math.sin(player.angle) * 12;
        particles.push({
            kind: 'casing', x: px, y: py,
            vx: Math.cos(a) * rnd(60, 130), vy: Math.sin(a) * rnd(60, 130),
            life: 2.2, max: 2.2, size: 3, color: '#d8b06a', rot: rnd(0, TAU)
        });
    }

    function fireWeapon() {
        if (player.dead || state.phase === 'intro') { return; }
        const key = state.current;
        const w = WEAPONS[key];
        const slot = weapons[key];
        if (!slot.owned) { return; }
        if (slot.reloading > 0 || player.switchT > 0) { return; }
        if (slot.cool > 0) { return; }
        if (slot.mag <= 0) {
            SFX.dryFire();
            slot.cool = 0.2;
            startReload();
            return;
        }
        slot.mag -= 1;
        slot.cool = w.rate;
        player.recoil = w.kick;
        player.kick = w.kick * 0.8;
        player.muzzle = 0.07;
        screenshake.v = Math.max(screenshake.v, w.kick * 0.45);
        const muzzleDist = (18 + w.len + 12) * 1.24;
        const muzzle = {
            x: player.x + Math.cos(player.angle) * muzzleDist,
            y: player.y + Math.sin(player.angle) * muzzleDist
        };
        flashes.push({ x: muzzle.x, y: muzzle.y, r: 130 + w.kick * 20, life: 0.09, color: '#ffcf7a' });
        for (let i = 0; i < w.pellets; i++) {
            const spread = w.spread * (w.pellets > 1 ? 1 : 1.2);
            const a = player.angle + rnd(-spread, spread);
            bullets.push({
                x: muzzle.x, y: muzzle.y, px: muzzle.x, py: muzzle.y,
                vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
                life: w.range / w.speed, dmg: w.dmg, pierce: w.pierce || 0,
                hits: [], color: w.ammo === 'shell' ? '#ffcf8a' : '#ffe8b0'
            });
        }
        // 枪口烟
        for (let i = 0; i < 3; i++) {
            particles.push({
                kind: 'smoke', x: muzzle.x, y: muzzle.y,
                vx: Math.cos(player.angle) * rnd(20, 80) + rnd(-20, 20),
                vy: Math.sin(player.angle) * rnd(20, 80) + rnd(-20, 20),
                life: rnd(0.3, 0.6), max: 0.6, size: rnd(3, 8), color: 'rgba(190,190,180,0.16)'
            });
        }
        ejectShell();
        if (w.ammo === 'shell') { SFX.shotgun(); }
        else if (w.ammo === 'heavy') { SFX.rifle(); }
        else if (key === 'smg') { SFX.smg(); }
        else { SFX.pistol(); }
    }

    function meleeAttack() {
        if (player.dead || melee.cool > 0 || state.phase === 'intro') { return; }
        melee.cool = 0.5;
        melee.anim = 1;
        melee.angle = player.angle;
        SFX.knife();
        let hit = false;
        for (const z of zombies) {
            if (z.dead) { continue; }
            const d = dist(player.x, player.y, z.x, z.y);
            if (d > 68 + z.r) { continue; }
            const a = Math.atan2(z.y - player.y, z.x - player.x);
            if (Math.abs(angleDiff(a, player.angle)) > 1.15) { continue; }
            damageZombie(z, 42, a);
            hit = true;
        }
        if (hit) { SFX.knifeHit(); screenshake.v = Math.max(screenshake.v, 2); }
        spawnDust(player.x + Math.cos(player.angle) * 30, player.y + Math.sin(player.angle) * 30, 3, 'rgba(210,200,180,0.18)');
    }

    function damageZombie(z, dmg, angle) {
        if (z.dead) { return; }
        z.hp -= dmg;
        z.hitFlash = 0.12;
        hitMarker.t = 0.16;
        hitMarker.kill = z.hp <= 0;
        z.knockX += Math.cos(angle) * 34;
        z.knockY += Math.sin(angle) * 34;
        const bx = z.x + Math.cos(angle) * z.r * 0.5;
        const by = z.y + Math.sin(angle) * z.r * 0.5;
        for (let i = 0; i < 5; i++) {
            particles.push({
                kind: 'blood', x: bx, y: by,
                vx: Math.cos(angle + rnd(-0.8, 0.8)) * rnd(40, 170),
                vy: Math.sin(angle + rnd(-0.8, 0.8)) * rnd(40, 170),
                life: rnd(0.3, 0.75), max: 0.75, size: rnd(2, 6),
                color: ZOMBIE[z.kind].blood
            });
        }
        SFX.flesh();
        if (z.hp <= 0) {
            killZombie(z, angle);
        }
        addFloater(z.x, z.y - z.r - 10, String(Math.round(dmg)), '#ffd9a0');
    }

    function killZombie(z, angle) {
        z.dead = true;
        state.kills++;
        SFX.zombieDown(z.kind);
        const blood = ZOMBIE[z.kind].blood;
        for (let i = 0; i < 18; i++) {
            particles.push({
                kind: 'blood', x: z.x, y: z.y,
                vx: Math.cos(angle + rnd(-1.1, 1.1)) * rnd(40, 260),
                vy: Math.sin(angle + rnd(-1.1, 1.1)) * rnd(40, 220),
                life: rnd(0.4, 1.1), max: 1.1, size: rnd(2, 8), color: blood
            });
        }
        bloodStamps.push({ x: z.x, y: z.y, r: z.r * (1.4 + Math.random()), rot: rnd(0, TAU) });
        if (bloodStamps.length > 44) { bloodStamps.shift(); }
        corpses.push({
            x: z.x, y: z.y, kind: z.kind, angle: angle + Math.PI / 2,
            life: 30, fade: 1, seed: rnd(0, 1000)
        });
        if (corpses.length > CFG.zombie.corpseMax) { corpses.shift(); }
        // 掉落
        if (Math.random() < 0.24) {
            const types = ['light', 'light', 'shell', 'heavy', 'medkit', 'armor'];
            const t = pick(types);
            spawnPickup(t, t === 'medkit' ? 1 : t === 'armor' ? 12 : rndInt(6, 14), z.x + rnd(-8, 8), z.y + rnd(-8, 8));
        }
        if (z.wasBrute) {
            for (let i = 0; i < 6; i++) {
                spawnPickup(pick(['light', 'shell', 'heavy', 'armor']), rndInt(6, 16), z.x + rnd(-20, 20), z.y + rnd(-20, 20));
            }
        }
        if (state.kills === 1) { hintMsg('第一滴血 · 保持移动', '#ffcf8a'); }
    }

    // ============================================================ 武器逻辑
    function startReload() {
        const key = state.current;
        const w = WEAPONS[key];
        const slot = weapons[key];
        if (!slot.owned || slot.reloading > 0 || player.switchT > 0) { return; }
        if (slot.mag >= w.mag || ammo[w.ammo] <= 0) { return; }
        slot.reloadTime = w.reload;
        slot.reloading = w.reload;
        SFX.reload(w.reload, key);
    }

    function finishReload(key) {
        const w = WEAPONS[key];
        const slot = weapons[key];
        const need = w.mag - slot.mag;
        const take = Math.min(need, ammo[w.ammo]);
        slot.mag += take;
        ammo[w.ammo] -= take;
    }

    function switchWeapon(index) {
        const key = WEAPON_ORDER[index];
        if (!key || !weapons[key].owned || key === state.current) { return; }
        state.current = key;
        player.switchT = CFG.weapons.switchTime;
        weapons[key].reloading = 0;
        SFX.equip();
        hintMsg(WEAPONS[key].cn + ' · ' + WEAPONS[key].name, theme.accent2, 1.1);
    }

    function nextWeapon() {
        let idx = WEAPON_ORDER.indexOf(state.current);
        for (let i = 1; i <= WEAPON_ORDER.length; i++) {
            const next = (idx + i) % WEAPON_ORDER.length;
            if (weapons[WEAPON_ORDER[next]].owned) { switchWeapon(next); return; }
        }
    }

    function nextMissingWeapon() {
        const unowned = WEAPON_ORDER.filter((k) => !weapons[k].owned);
        if (!unowned.length) { return null; }
        // 先看哪些口径还没有对应枪：例如手枪已经覆盖 9mm，就不该再优先给冲锋枪。
        const covered = new Set(WEAPON_ORDER.filter((k) => weapons[k].owned).map((k) => WEAPONS[k].ammo));
        const uncovered = unowned.filter((k) => !covered.has(WEAPONS[k].ammo));
        const useful = uncovered.filter((k) => ammo[WEAPONS[k].ammo] > 0);
        if (useful.length) {
            useful.sort((a, b) => ammo[WEAPONS[b].ammo] - ammo[WEAPONS[a].ammo]);
            return useful[0];
        }
        if (uncovered.length) {
            const anyWithAmmo = unowned.filter((k) => ammo[WEAPONS[k].ammo] > 0);
            if (anyWithAmmo.length) {
                anyWithAmmo.sort((a, b) => ammo[WEAPONS[b].ammo] - ammo[WEAPONS[a].ammo]);
                return anyWithAmmo[0];
            }
            return pick(uncovered);
        }
        const withAmmo = unowned.filter((k) => ammo[WEAPONS[k].ammo] > 0);
        if (withAmmo.length) {
            withAmmo.sort((a, b) => ammo[WEAPONS[b].ammo] - ammo[WEAPONS[a].ammo]);
            return withAmmo[0];
        }
        return pick(unowned);
    }

    function grantWeapon(key) {
        if (weapons[key].owned) {
            ammo[WEAPONS[key].ammo] = Math.min(ammoCap(WEAPONS[key].ammo), ammo[WEAPONS[key].ammo] + WEAPONS[key].mag * 2);
            addFloater(player.x, player.y - 30, '+' + (WEAPONS[key].mag * 2) + ' ' + ITEM[WEAPONS[key].ammo].name, ITEM[WEAPONS[key].ammo].color);
            return;
        }
        weapons[key].owned = true;
        weapons[key].mag = WEAPONS[key].mag;
        ammo[WEAPONS[key].ammo] = Math.min(ammoCap(WEAPONS[key].ammo), ammo[WEAPONS[key].ammo] + WEAPONS[key].mag * 3);
        switchWeapon(WEAPON_ORDER.indexOf(key));
        toast('获得 ' + WEAPONS[key].cn + ' · ' + WEAPONS[key].name + ' · 已装备（按 ' + WEAPONS[key].slot + '）', theme.accent2);
        hintMsg('已装备 ' + WEAPONS[key].name + ' · 按 ' + WEAPONS[key].slot + ' 切换', theme.accent2, 2.2);
        SFX.equip();
    }

    function ammoCap(type) {
        return { light: 300, shell: 90, heavy: 150 }[type] || 200;
    }

    function useMedkit() {
        if (player.dead || medkits <= 0 || player.hp >= CFG.player.hp) {
            if (medkits <= 0) { hintMsg('没有医疗包', '#ff8f8f'); }
            return;
        }
        medkits--;
        const before = player.hp;
        player.hp = Math.min(CFG.player.hp, player.hp + 45);
        addFloater(player.x, player.y - 30, '+' + Math.round(player.hp - before), '#8dffb0');
        spawnDust(player.x, player.y, 8, 'rgba(140,255,190,0.35)');
        SFX.heal();
    }

    function addArmor(amount) {
        const before = player.armor;
        player.armor = Math.min(CFG.player.armorMax, player.armor + amount);
        addFloater(player.x, player.y - 24, '+' + Math.round(player.armor - before) + ' 护甲', ITEM.armor.color);
    }

    // ============================================================ 伤害 / 死亡
    function damagePlayer(amount, fromX, fromY) {
        if (player.dead || player.invuln > 0 || state.phase === 'intro') { return; }
        let dmg = amount;
        if (player.armor > 0) {
            const absorbed = Math.min(player.armor, dmg * 0.62);
            player.armor -= absorbed;
            dmg -= absorbed;
            SFX.armorHit();
            spawnParticles(fromX || player.x, fromY || player.y, 5, 'spark', '#bcd9e8');
        }
        if (dmg > 0) {
            player.hp -= dmg;
            player.hurt = 0.3;
            player.invuln = 0.5;
            damageFlash.v = Math.min(1, damageFlash.v + dmg / 35);
            screenshake.v = Math.max(screenshake.v, 4 + dmg * 0.12);
            SFX.hurt();
            for (let i = 0; i < 7; i++) {
                particles.push({
                    kind: 'blood', x: player.x, y: player.y,
                    vx: rnd(-80, 80), vy: rnd(-80, 80),
                    life: rnd(0.3, 0.6), max: 0.6, size: rnd(2, 5), color: theme.blood
                });
            }
            addFloater(player.x, player.y - 32, '-' + Math.round(dmg), '#ff8a8a');
            if (player.hp <= 0) {
                player.hp = 0;
                die();
            }
        } else {
            player.invuln = 0.3;
        }
    }

    function die() {
        if (state.phase === 'dead') { return; }
        state.intro = 0;
        state.phase = 'dead';
        state.active = false;
        player.dead = true;
        player.dodge = 0;
        SFX.death();
        setAmbience(false, audio.muted);
        state.endTimer = 1.4;
        state.best = null;
        hintMsg('生命信号消失', '#ff6b6b', 2);
        window.setTimeout(() => {
            if (!destroyed && state.phase === 'dead') { showEnd(false); }
        }, 1200);
    }

    // ============================================================ 搜刮 / 拾取
    function containerNear() {
        let best = null, bestD = CFG.loot.radius;
        for (const c of containers) {
            if (c.opened) { continue; }
            const d = dist(player.x, player.y, c.x, c.y);
            if (d < bestD) { bestD = d; best = c; }
        }
        return best;
    }

    function openContainer(c) {
        if (!c || c.opened) { return; }
        c.opened = true;
        c.glow = 1;
        state.opened++;
        SFX.loot();
        const info = LOOT[c.t];
        const rand = seeded(Math.floor(c.x * 7 + c.y * 3 + state.level * 31));
        if (c.t === 'gun') {
            const key = nextMissingWeapon();
            if (key) {
                grantWeapon(key);
                addFloater(c.x, c.y - 30, '获得 ' + WEAPONS[key].cn, '#ffd27f');
            } else {
                applyLoot('armor', 30, c.x, c.y, info.color);
                applyLoot('heavy', 24, c.x, c.y, info.color);
            }
        } else {
            const count = c.t === 'military' || c.t === 'med' ? 2 : (rand() < 0.35 ? 2 : 1);
            for (let i = 0; i < count; i++) {
                const entry = weightPick(info.table);
                applyLoot(entry.item, rndInt(entry.min, entry.max), c.x, c.y, info.color);
            }
        }
        for (let i = 0; i < 12; i++) {
            particles.push({
                kind: 'spark', x: c.x, y: c.y,
                vx: rnd(-90, 90), vy: rnd(-130, -20),
                life: rnd(0.4, 0.9), max: 0.9, size: rnd(1.5, 3.5),
                color: info.color
            });
        }
        screenshake.v = Math.max(screenshake.v, 1);
        search.target = null;
        search.timer = 0;
    }

    function ammoNeedName(type) {
        return type === 'shell' ? '霰弹枪' : (type === 'heavy' ? '步枪' : '手枪/冲锋枪');
    }

    function hasGunForAmmo(type) {
        return WEAPON_ORDER.some((k) => weapons[k].owned && WEAPONS[k].ammo === type);
    }

    function missingGunHint(type) {
        if (hasGunForAmmo(type)) { return; }
        hintMsg('获得 ' + ITEM[type].name + ' · 还没有' + ammoNeedName(type) + '，已存入背包', '#ffb36b', 2.4);
        toast('缺少' + ammoNeedName(type) + ' · 找到枪械箱即可使用', '#ffb36b');
    }

    function applyLoot(type, amount, x, y, color) {
        if (type === 'weapon') {
            const key = nextMissingWeapon();
            if (key) {
                grantWeapon(key);
            } else {
                type = 'heavy'; amount = 24;
            }
        }
        if (type === 'light' || type === 'shell' || type === 'heavy') {
            ammo[type] = Math.min(ammoCap(type), ammo[type] + amount);
            addFloater(x, y - 24, '+' + amount + ' ' + ITEM[type].name, ITEM[type].color);
            missingGunHint(type);
            SFX.pickup();
        } else if (type === 'medkit') {
            medkits = Math.min(6, medkits + amount);
            addFloater(x, y - 24, '+' + amount + ' 医疗包', ITEM.medkit.color);
            SFX.pickup();
        } else if (type === 'armor') {
            addArmor(amount);
            SFX.pickup();
        }
    }

    function spawnPickup(type, amount, x, y) {
        pickups.push({
            type: type, amount: amount, x: x, y: y,
            bob: rnd(0, TAU), life: CFG.weapons.dropLife, vx: 0, vy: 0
        });
    }

    function updatePickups(dt) {
        for (let i = pickups.length - 1; i >= 0; i--) {
            const p = pickups[i];
            p.life -= dt;
            p.bob += dt * 3.4;
            const d = dist(player.x, player.y, p.x, p.y);
            if (d < 100) {
                const a = Math.atan2(player.y - p.y, player.x - p.x);
                const pull = (1 - d / 100) * 280;
                p.vx += Math.cos(a) * pull * dt * 3;
                p.vy += Math.sin(a) * pull * dt * 3;
            }
            p.vx *= 1 - dt * 4;
            p.vy *= 1 - dt * 4;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (d < 26) {
                if (p.type === 'medkit') {
                    medkits = Math.min(6, medkits + p.amount);
                    addFloater(p.x, p.y - 20, '+' + p.amount + ' 医疗包', ITEM.medkit.color);
                } else if (p.type === 'armor') {
                    addArmor(p.amount);
                } else {
                    ammo[p.type] = Math.min(ammoCap(p.type), ammo[p.type] + p.amount);
                    addFloater(p.x, p.y - 20, '+' + p.amount + ' ' + ITEM[p.type].name, ITEM[p.type].color);
                    missingGunHint(p.type);
                }
                SFX.pickup();
                pickups.splice(i, 1);
                continue;
            }
            if (p.life <= 0) { pickups.splice(i, 1); }
        }
    }

    function updateSearch(dt) {
        search.near = containerNear();
        if (!input.search || !search.near || player.dead) {
            search.target = null;
            search.timer = 0;
            return;
        }
        if (search.target !== search.near) {
            search.target = search.near;
            search.timer = 0;
            SFX.search();
        }
        search.timer += dt;
        search.pulse += dt;
        if (search.timer >= search.near.time) {
            openContainer(search.near);
            input.search = false;
        }
    }

    // ============================================================ 僵尸
    function zombieStats(kind) {
        const def = ZOMBIE[kind];
        const n = state.level;
        const hp = (CFG.night.hpBase + n * CFG.night.hpPerLevel) * def.hp;
        const speed = (CFG.night.speedBase + n * CFG.night.speedPerLevel) * def.speed;
        const dmg = (CFG.night.dmgBase + n * CFG.night.dmgPerLevel) * def.dmg;
        return { hp: hp, speed: speed, dmg: dmg };
    }

    function rollZombieKind() {
        const r = Math.random();
        const levelBias = state.level * 0.055;
        if (r < 0.1 + levelBias && state.level >= 1) { return 'brute'; }
        if (r < 0.34 + levelBias * 2.2) { return 'runner'; }
        return 'walker';
    }

    function spawnZombie(kind) {
        const stats = zombieStats(kind);
        const def = ZOMBIE[kind];
        let spot = null;
        if (nav.ready) {
            for (let tries = 0; tries < 90; tries++) {
                const cx = rndInt(2, nav.cols - 3);
                const cy = rndInt(2, nav.rows - 3);
                if (!nav.walk[cy * nav.cols + cx]) { continue; }
                const d = nav.dist[cy * nav.cols + cx];
                if (d < 12) { continue; }
                const x = cx * nav.cell + nav.cell / 2;
                const y = cy * nav.cell + nav.cell / 2;
                const pd = dist(x, y, player.x, player.y);
                if (pd < 520 || pd > 1250) { continue; }
                if (!lineBlocked(x, y, player.x, player.y) && pd < 780) { continue; }
                spot = { x: x, y: y };
                break;
            }
        }
        if (!spot) {
            const a = rnd(0, TAU);
            const r = rnd(520, 800);
            spot = {
                x: clamp(player.x + Math.cos(a) * r, 40, W - 40),
                y: clamp(player.y + Math.sin(a) * r, 40, H - 40)
            };
        }
        zombies.push({
            kind: kind, x: spot.x, y: spot.y, r: def.r,
            hp: stats.hp, maxHp: stats.hp, speed: stats.speed, dmg: stats.dmg,
            vx: 0, vy: 0, angle: rnd(0, TAU), walk: rnd(0, TAU),
            wind: 0, windOn: false, cool: rnd(0, 0.6), dead: false,
            hitFlash: 0, knockX: 0, knockY: 0, stall: 0, wasBrute: kind === 'brute',
            seed: rnd(0, 1000), bite: 0
        });
    }

    function spawnWave() {
        const maxAlive = CFG.night.maxAliveBase + state.level * CFG.night.maxAlivePerLevel;
        if (zombies.length >= maxAlive) { return; }
        const count = Math.min(maxAlive - zombies.length, 2 + Math.floor(state.level / 2) + rndInt(0, 2));
        for (let i = 0; i < count; i++) {
            spawnZombie(rollZombieKind());
        }
        state.waveCount = (state.waveCount || 0) + 1;
        if (state.waveCount <= 3) {
            hintMsg(count + ' 个影子正在靠近', '#ff9d8a', 1.2);
        }
    }

    function flowDir(z) {
        if (!nav.ready) { return null; }
        const cx = clamp(Math.floor(z.x / nav.cell), 0, nav.cols - 1);
        const cy = clamp(Math.floor(z.y / nav.cell), 0, nav.rows - 1);
        const here = cy * nav.cols + cx;
        let best = -1;
        let bestD = nav.dist[here];
        if (bestD < 0) { bestD = Infinity; }
        for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
                if (!ox && !oy) { continue; }
                const nx = cx + ox, ny = cy + oy;
                if (nx < 0 || ny < 0 || nx >= nav.cols || ny >= nav.rows) { continue; }
                const ni = ny * nav.cols + nx;
                if (!nav.walk[ni]) { continue; }
                if (ox && oy && (!nav.walk[cy * nav.cols + nx] || !nav.walk[ny * nav.cols + cx])) { continue; }
                const d = nav.dist[ni];
                if (d < 0) { continue; }
                if (d < bestD) { bestD = d; best = ni; }
            }
        }
        if (best < 0) { return null; }
        const bx = (best % nav.cols) * nav.cell + nav.cell / 2;
        const by = Math.floor(best / nav.cols) * nav.cell + nav.cell / 2;
        return Math.atan2(by - z.y, bx - z.x);
    }

    function updateZombies(dt) {
        if (state.phase !== 'night' && state.phase !== 'day') { return; }
        for (let i = zombies.length - 1; i >= 0; i--) {
            const z = zombies[i];
            if (z.dead) { zombies.splice(i, 1); continue; }
            z.walk += dt * (2.4 + z.speed * 0.012);
            z.hitFlash = Math.max(0, z.hitFlash - dt);
            z.bite = Math.max(0, z.bite - dt);
            z.cool = Math.max(0, z.cool - dt);
            const dx = player.x - z.x, dy = player.y - z.y;
            const d = Math.hypot(dx, dy);
            const direct = d < 330 && !lineBlocked(z.x, z.y, player.x, player.y);
            let targetAngle;
            if (direct) {
                targetAngle = Math.atan2(dy, dx);
            } else {
                const a = flowDir(z);
                targetAngle = a === null ? Math.atan2(dy, dx) : a;
            }
            z.angle += angleDiff(targetAngle, z.angle) * Math.min(1, dt * 4.2);
            let speed = z.speed;
            if (z.kind === 'runner') { speed *= 0.9 + Math.sin(z.walk * 2.2) * 0.1; }
            let vx = Math.cos(z.angle) * speed;
            let vy = Math.sin(z.angle) * speed;
            // 群体分离
            for (const other of zombies) {
                if (other === z || other.dead) { continue; }
                const ox = z.x - other.x, oy = z.y - other.y;
                const od = Math.hypot(ox, oy);
                const min = z.r + other.r + 6;
                if (od > 0.001 && od < min) {
                    const push = (min - od) * 2.6;
                    vx += (ox / od) * push;
                    vy += (oy / od) * push;
                }
            }
            z.vx = lerp(z.vx, vx, Math.min(1, dt * 5));
            z.vy = lerp(z.vy, vy, Math.min(1, dt * 5));
            z.knockX *= 1 - dt * 8;
            z.knockY *= 1 - dt * 8;
            z.hitWall = false;
            moveActor(z, (z.vx + z.knockX) * dt, (z.vy + z.knockY) * dt, z.r, true);

            // 攻击
            const reach = z.r + CFG.player.r + 10;
            if (d < reach) {
                if (!z.windOn) {
                    z.windOn = true;
                    z.wind = CFG.zombie.biteWind;
                    z.bite = 1;
                    SFX.swingTell();
                }
                z.wind -= dt;
                if (z.wind <= 0 && z.cool <= 0) {
                    z.cool = CFG.zombie.biteCool;
                    z.windOn = false;
                    z.bite = 0;
                    SFX.zombieBite();
                    damagePlayer(z.dmg, z.x, z.y);
                }
            } else {
                z.windOn = false;
                z.wind = 0;
            }

            if (z.hitWall) { z.stall += dt; } else { z.stall = Math.max(0, z.stall - dt * 0.5); }
            if (z.stall > 2.6) {
                // 卡墙时侧向滑一下
                const side = Math.atan2(player.y - z.y, player.x - z.x) + Math.PI / 2;
                moveActor(z, Math.cos(side) * z.speed * dt * 3, Math.sin(side) * z.speed * dt * 3, z.r, true);
                z.stall = 0;
            }
        }
    }

    // ============================================================ 子弹
    const flashes = [];

    function updateBullets(dt) {
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.px = b.x; b.py = b.y;
            b.life -= dt;
            if (b.life <= 0) { bullets.splice(i, 1); continue; }
            const nx = b.x + b.vx * dt;
            const ny = b.y + b.vy * dt;

            // 僵尸命中
            let hitZ = null, hitT = 2;
            for (const z of zombies) {
                if (z.dead || b.hits.indexOf(z) >= 0) { continue; }
                const t = segmentCircleHit(b.x, b.y, nx, ny, z.x, z.y, z.r);
                if (t >= 0 && t < hitT) { hitT = t; hitZ = z; }
            }
            // 墙体命中
            let wallT = 2;
            for (const s of solids) {
                const t = segmentRectHit(b.x, b.y, nx, ny, s);
                if (t >= 0 && t < wallT) { wallT = t; }
            }
            for (const c of circleSolids) {
                const t = segmentCircleHit(b.x, b.y, nx, ny, c.x, c.y, c.r);
                if (t >= 0 && t < wallT) { wallT = t; }
            }

            if (hitZ && hitT <= wallT) {
                b.x = b.x + (nx - b.x) * hitT;
                b.y = b.y + (ny - b.y) * hitT;
                const angle = Math.atan2(b.vy, b.vx);
                damageZombie(hitZ, b.dmg, angle);
                b.hits.push(hitZ);
                if (b.hits.length > b.pierce) {
                    bullets.splice(i, 1);
                    continue;
                }
            } else if (wallT <= 1) {
                const px = b.x + (nx - b.x) * wallT;
                const py = b.y + (ny - b.y) * wallT;
                for (let k = 0; k < 4; k++) {
                    particles.push({
                        kind: 'spark', x: px, y: py,
                        vx: rnd(-120, 120), vy: rnd(-120, 120),
                        life: rnd(0.12, 0.3), max: 0.3, size: rnd(1, 2.5), color: '#ffd18a'
                    });
                }
                particles.push({
                    kind: 'dust', x: px, y: py, vx: 0, vy: 0,
                    life: 0.35, max: 0.35, size: rnd(4, 9), color: 'rgba(180,175,160,0.26)'
                });
                SFX.wallHit();
                bullets.splice(i, 1);
                continue;
            } else {
                b.x = nx; b.y = ny;
            }
            if (b.x < 0 || b.y < 0 || b.x > W || b.y > H) { bullets.splice(i, 1); }
        }
    }

    function segmentRectHit(x1, y1, x2, y2, s) {
        let tmin = 0, tmax = 1;
        const dx = x2 - x1, dy = y2 - y1;
        for (let axis = 0; axis < 2; axis++) {
            const p = axis === 0 ? x1 : y1;
            const d = axis === 0 ? dx : dy;
            const min = axis === 0 ? s.x : s.y;
            const max = axis === 0 ? s.x + s.w : s.y + s.h;
            if (Math.abs(d) < 0.00001) {
                if (p < min || p > max) { return -1; }
            } else {
                let t1 = (min - p) / d;
                let t2 = (max - p) / d;
                if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
                tmin = Math.max(tmin, t1);
                tmax = Math.min(tmax, t2);
                if (tmin > tmax) { return -1; }
            }
        }
        return tmin;
    }

    // ============================================================ 粒子
    function spawnParticles(x, y, count, kind, color) {
        for (let i = 0; i < count; i++) {
            particles.push({
                kind: kind, x: x, y: y,
                vx: rnd(-100, 100), vy: rnd(-100, 100),
                life: rnd(0.15, 0.45), max: 0.45,
                size: rnd(1, 3.5), color: color || '#ffcf8a'
            });
        }
    }

    function spawnDust(x, y, count, color) {
        for (let i = 0; i < count; i++) {
            particles.push({
                kind: 'dust', x: x + rnd(-8, 8), y: y + rnd(-5, 5),
                vx: rnd(-18, 18), vy: rnd(-18, 18),
                life: rnd(0.3, 0.7), max: 0.7, size: rnd(3, 9),
                color: color || 'rgba(190,185,160,0.35)'
            });
        }
    }

    function addFloater(x, y, text, color) {
        floaters.push({ x: x, y: y, text: text, color: color || '#fff', life: 0.85, max: 0.85 });
        if (floaters.length > 40) { floaters.shift(); }
    }

    function updateParticles(dt) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.life -= dt;
            if (p.life <= 0) { particles.splice(i, 1); continue; }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.kind === 'blood') { p.vx *= 1 - dt * 3; p.vy *= 1 - dt * 3; }
            else if (p.kind === 'dust' || p.kind === 'smoke') { p.vx *= 1 - dt * 2; p.vy *= 1 - dt * 2; p.size += dt * 10; }
            else if (p.kind === 'casing') {
                p.vy += 260 * dt;
                p.vx *= 1 - dt * 2;
                p.rot += dt * 12;
            } else if (p.kind === 'spark') { p.vx *= 1 - dt * 4; p.vy *= 1 - dt * 4; }
        }
        if (particles.length > CFG.maxParticles) { particles.splice(0, particles.length - CFG.maxParticles); }

        for (let i = floaters.length - 1; i >= 0; i--) {
            const f = floaters[i];
            f.life -= dt;
            f.y -= dt * 26;
            if (f.life <= 0) { floaters.splice(i, 1); }
        }
        for (let i = corpses.length - 1; i >= 0; i--) {
            const c = corpses[i];
            c.life -= dt;
            if (c.life <= 0) { corpses.splice(i, 1); }
        }
        for (let i = flashes.length - 1; i >= 0; i--) {
            flashes[i].life -= dt;
            if (flashes[i].life <= 0) { flashes.splice(i, 1); }
        }
        for (let i = bloodStamps.length - 1; i >= 0; i--) {
            // 血泊会一直留到本关结束
            if (bloodStamps[i].r <= 0) { bloodStamps.splice(i, 1); }
        }
    }

    // ============================================================ 枪口 / 光源位置
    function lightHead(l) {
        const dir = l.rot >= 0 ? 1 : -1;
        if (l.t === 'street') { return { x: l.x, y: l.y + dir * 23 }; }
        if (l.t === 'searchlight') { return { x: l.x, y: l.y - 30 }; }
        return { x: l.x, y: l.y };
    }

    // ============================================================ 关卡流程
    function startLevel(index) {
        initAudio();
        startLevelInternal(index);
    }

    function startLevelInternal(index, opts) {
        opts = opts || {};
        const carrySnap = opts.carry ? captureLoadout() : null;
        const checkpointSnap = opts.checkpoint ? state.levelStartLoadout : null;
        const carriedNames = carrySnap ? loadoutWeaponNames() : '';
        state.selected = clamp(index, 0, LEVELS.length - 1);
        buildLevel(state.selected);
        if (carrySnap) { applyLoadout(carrySnap); }
        else if (checkpointSnap) { applyLoadout(checkpointSnap); }
        state.level = state.selected;
        player.hp = CFG.player.hp;
        state.levelStartLoadout = captureLoadout();
        state.phase = 'day';
        state.active = true;
        state.paused = false;
        state.intro = 2.6;
        state.dayTimer = level.time;
        state.nightFade = 0;
        state.exitOpen = false;
        state.time = 0;
        if (exitZone) { exitZone.active = false; }
        hideOverlay();
        setAmbience(false, audio.muted);
        updateHud(true);
        if (opts.carry) {
            hintMsg('携带 ' + carriedNames + ' · 搜刮窗口 ' + level.time + ' 秒', theme.accent2, 2.6);
        } else if (opts.checkpoint) {
            hintMsg('起始装备 ' + loadoutWeaponNames() + ' · 搜刮窗口 ' + level.time + ' 秒', theme.accent2, 2.6);
        } else {
            hintMsg('搜刮窗口 ' + level.time + ' 秒', theme.accent2, 2);
        }
        if (opts.carry) {
            toast('装备已继承 · ' + carriedNames + ' · 生命已补给', '#ffd27f');
        } else if (opts.checkpoint) {
            toast('已回收本区起始装备 · ' + loadoutWeaponNames(), '#ffd27f');
        } else {
            const gunCase = containers.find((c) => c.t === 'gun' && !c.opened);
            if (gunCase) { toast('入口附近有枪械箱 · 缺枪时优先开它', '#ffd27f'); }
        }
        cam.x = clamp(player.x - view.w / 2, 0, W - view.w);
        cam.y = clamp(player.y - view.h / 2, 0, H - view.h);
    }

    function startNight() {
        state.phase = 'night';
        state.exitOpen = true;
        state.nightFade = 0.01;
        state.waveTimer = CFG.night.firstWave;
        if (exitZone) { exitZone.active = true; }
        SFX.night();
        SFX.siren();
        setAmbience(true, audio.muted);
        hintMsg('入夜 · 尸潮正在靠近', '#ff8a6a', 2.4);
        toast('撤离点已开启 · 信号弹在' + (exitZone ? '标记处' : '前方'), '#7dffb0');
        updateHud(true);
    }

    function rankFor(ratio, kills) {
        const score = ratio * 0.72 + Math.min(1, kills / 16) * 0.28;
        if (score >= 0.9) { return 'S'; }
        if (score >= 0.72) { return 'A'; }
        if (score >= 0.5) { return 'B'; }
        return 'C';
    }

    function completeLevel() {
        if (state.phase === 'complete') { return; }
        state.intro = 0;
        state.phase = 'complete';
        state.active = false;
        const ratio = state.lootTotal ? state.opened / state.lootTotal : 1;
        const rank = rankFor(ratio, state.kills);
        const id = String(state.level);
        const prev = state.ranks[id];
        let improved = false;
        if (!prev || 'SABC'.indexOf(rank) < 'SABC'.indexOf(prev)) {
            state.ranks[id] = rank;
            improved = true;
        }
        if (state.level < LEVELS.length - 1) {
            state.unlocked = Math.max(state.unlocked, state.level + 1);
        }
        saveProgress();
        state.newRank = rank;
        state.endTimer = 1.6;
        state.best = {
            rank: rank, improved: improved, time: state.time,
            kills: state.kills, opened: state.opened, total: state.lootTotal
        };
        SFX.clear();
        setAmbience(false, audio.muted);
        if (exitZone) { exitZone.active = true; }
        hintMsg('撤离成功 · 评价 ' + rank, theme.accent2, 2.4);
        for (let i = 0; i < 30; i++) {
            particles.push({
                kind: 'spark', x: player.x + rnd(-20, 20), y: player.y + rnd(-20, 20),
                vx: rnd(-160, 160), vy: rnd(-260, -80),
                life: rnd(0.5, 1.2), max: 1.2, size: rnd(1.5, 3.5), color: '#7dffb0'
            });
        }
        window.setTimeout(() => {
            if (!destroyed && state.phase === 'complete') { showEnd(true); }
        }, 1500);
    }

    // ============================================================ 主更新
    function update(dt) {
        if (state.paused) {
            if (state.phase === 'idle') {
                updateAmbientParticles(dt);
                updateParticles(dt);
            }
            return;
        }
        if (hint.t > 0) {
            hint.t = Math.max(0, hint.t - dt);
            if (hint.t <= 0 && ui && ui.hint) { ui.hint.classList.remove('is-on'); }
        }

        if (state.phase === 'idle') {
            // 标题界面的缓慢漂移
            const t = performance.now() / 1000;
            const targetX = level.spawn[0] - view.w * 0.42 + Math.sin(t * 0.09) * 120;
            const targetY = level.spawn[1] - view.h * 0.45 + Math.cos(t * 0.07) * 60;
            cam.x = lerp(cam.x, clamp(targetX, 0, Math.max(0, W - view.w)), Math.min(1, dt * 0.7));
            cam.y = lerp(cam.y, clamp(targetY, 0, Math.max(0, H - view.h)), Math.min(1, dt * 0.7));
            updateAmbientParticles(dt);
            updateParticles(dt);
            updateFlashes(dt);
            return;
        }

        if (state.phase === 'complete' || state.phase === 'dead') {
            updateParticles(dt);
            updateFlashes(dt);
            updateAmbientParticles(dt);
            if (state.phase === 'complete' && exitZone) {
                updateCamera(dt);
            }
            return;
        }

        state.time += dt;
        if (state.intro > 0) {
            state.intro -= dt;
        } else if (state.phase === 'day') {
            state.dayTimer = Math.max(0, state.dayTimer - dt);
            if (state.dayTimer <= 0) { startNight(); }
            if (exitZone && dist(player.x, player.y, exitZone.x, exitZone.y) < 130) {
                state.exitWarn = (state.exitWarn || 0) - dt;
                if (state.exitWarn <= 0) {
                    state.exitWarn = 3.2;
                    hintMsg('撤离点未开启 · 撑到入夜', '#ffb36b', 1.6);
                }
            }
        }

        refreshPointerWorld();
        updateNav(dt, false);
        updatePlayer(dt);
        updateZombies(dt);
        updateBullets(dt);
        updatePickups(dt);
        updateSearch(dt);
        updateParticles(dt);
        updateFlashes(dt);
        updateAmbientParticles(dt);

        // 夜晚波动
        if (state.phase === 'night') {
            state.nightFade = Math.min(1, state.nightFade + dt / CFG.night.fadeIn);
            state.waveTimer -= dt;
            if (state.waveTimer <= 0) {
                state.waveTimer = Math.max(2.2, CFG.night.waveGap - state.level * 0.12);
                spawnWave();
            }
            groanTimer -= dt;
            if (groanTimer <= 0) {
                groanTimer = rnd(2.4, 5.5);
                if (nearestZombie(720, player.angle, 0)) { SFX.groan(); }
            }
            if (exitZone && dist(player.x, player.y, exitZone.x, exitZone.y) < exitZone.r) {
                completeLevel();
            }
            if (exitZone) {
                exitBeep -= dt;
                if (exitBeep <= 0 && dist(player.x, player.y, exitZone.x, exitZone.y) > 500) {
                    exitBeep = 3.2;
                    SFX.exitBeep();
                }
            }
        }

        updateCamera(dt);
        state.shakeT += dt;
    }

    function updateFlashes(dt) {
        // 命中闪白等
        if (player.muzzle > 0) { /* 渲染时直接读取 */ }
    }

    function updateCamera(dt) {
        const look = 46;
        const leadX = Math.cos(player.angle) * look + player.vx * 0.22;
        const leadY = Math.sin(player.angle) * look + player.vy * 0.22;
        const tx = clamp(player.x + leadX - view.w / 2, 0, Math.max(0, W - view.w));
        const ty = clamp(player.y + leadY - view.h / 2, 0, Math.max(0, H - view.h));
        const k = 1 - Math.exp(-dt * 5.2);
        cam.x = lerp(cam.x, tx, k);
        cam.y = lerp(cam.y, ty, k);
        screenshake.v *= Math.pow(0.0015, dt);
        if (screenshake.v < 0.05) { screenshake.v = 0; }
        cam.shakeX = rnd(-1, 1) * screenshake.v;
        cam.shakeY = rnd(-1, 1) * screenshake.v;
    }

    // ============================================================ 环境粒子
    const ambient = { motes: [], t: 0, made: false };

    function updateAmbientParticles(dt) {
        ambient.t += dt;
        const weather = theme.weather;
        const count = weather === 'rain' ? 130 : weather === 'ember' ? 46 : 68;
        if (!ambient.made) {
            ambient.made = true;
            ambient.motes.length = 0;
            for (let i = 0; i < count; i++) {
                ambient.motes.push(makeMote(weather, true));
            }
        }
        while (ambient.motes.length < count) {
            ambient.motes.push(makeMote(weather, false));
        }
        while (ambient.motes.length > count) {
            ambient.motes.pop();
        }
        for (const m of ambient.motes) {
            m.x += m.vx * dt;
            m.y += m.vy * dt;
            m.life -= dt;
            if (m.life <= 0 || m.x < -20 || m.x > view.w + 20 || m.y < -20 || m.y > view.h + 20) {
                const nm = makeMote(weather, false);
                m.x = nm.x; m.y = nm.y; m.vx = nm.vx; m.vy = nm.vy;
                m.life = nm.life; m.size = nm.size; m.max = nm.max; m.color = nm.color;
            }
        }
    }

    function makeMote(weather, initial) {
        const w = view.w || 1200, h = view.h || 700;
        if (weather === 'rain') {
            return {
                x: rnd(-30, w + 30), y: initial ? rnd(0, h) : rnd(-40, -5),
                vx: -34, vy: 620, life: rnd(1.2, 2.6), max: 2.6,
                size: rnd(9, 20), color: 'rgba(180,210,225,0.20)'
            };
        }
        if (weather === 'ember') {
            return {
                x: initial ? rnd(0, w) : rnd(-20, w + 20), y: initial ? rnd(0, h) : h + 10,
                vx: rnd(-14, 26), vy: rnd(-34, -12), life: rnd(2, 5), max: 5,
                size: rnd(1, 2.6), color: 'rgba(255,150,70,0.55)'
            };
        }
        if (weather === 'drip') {
            return {
                x: rnd(0, w), y: rnd(0, h), vx: 0, vy: rnd(4, 14), life: rnd(0.4, 1.2), max: 1.2,
                size: rnd(1, 2.6), color: 'rgba(160,210,210,0.16)'
            };
        }
        return {
            x: initial ? rnd(0, w) : rnd(-30, w + 30), y: initial ? rnd(0, h) : h + 10,
            vx: rnd(6, 34), vy: rnd(-24, -8), life: rnd(2.6, 6), max: 6,
            size: rnd(0.8, 2.4), color: 'rgba(200,190,170,0.20)'
        };
    }

    // ============================================================ 辅助
    function hintMsg(text, color, dur) {
        hint.text = text;
        hint.color = color || theme.accent;
        hint.t = dur || 1.6;
        if (ui && ui.hint) {
            ui.hint.textContent = text;
            ui.hint.style.color = hint.color;
            ui.hint.classList.add('is-on');
        }
    }

    function toast(text, color) {
        const item = { text: text, color: color || theme.accent, life: 2.4 };
        toasts.push(item);
        if (toasts.length > 4) { toasts.shift(); }
        if (ui && ui.toasts) {
            const el = document.createElement('p');
            el.textContent = text;
            el.style.borderLeftColor = item.color;
            ui.toasts.appendChild(el);
            window.setTimeout(() => {
                el.classList.add('is-out');
                window.setTimeout(() => { if (el.parentNode) { el.parentNode.removeChild(el); } }, 500);
            }, 2100);
        }
    }

    // ============================================================ 渲染
    let clockTime = 0;
    let grainPattern = null;
    let fpsValue = 60;
    let fpsAccum = 0;
    let fpsFrames = 0;

    function render() {
        if (!ctx) { return; }
        const dpr = view.dpr;
        const cw = view.w * view.scale;
        const ch = view.h * view.scale;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cw, ch);
        ctx.fillStyle = theme.night;
        ctx.fillRect(0, 0, cw, ch);

        const shx = cam.shakeX;
        const shy = cam.shakeY;
        ctx.save();
        ctx.scale(view.scale, view.scale);
        ctx.translate(-cam.x + shx / view.scale, -cam.y + shy / view.scale);

        const sx = clamp(cam.x, 0, Math.max(0, W - 1));
        const sy = clamp(cam.y, 0, Math.max(0, H - 1));
        const sw = Math.min(view.w + 2, W - sx);
        const sh = Math.min(view.h + 2, H - sy);
        if (worldCanvas) {
            ctx.drawImage(worldCanvas, sx, sy, sw, sh, sx, sy, sw, sh);
        }

        drawBloodStamps(ctx);
        drawExitGround(ctx);
        drawExitObject(ctx);
        drawContainers(ctx);
        drawPickups(ctx);
        drawCorpses(ctx);
        drawFires(ctx);
        drawActors(ctx);
        drawBulletsAndTracers(ctx);
        drawParticles(ctx);
        drawInteraction(ctx);
        drawFloaters(ctx);

        ctx.restore();

        drawLighting();
        drawWeather();
        drawScreenHints();
        drawPost();
        drawCrosshair();
    }

    function drawBloodStamps(g) {
        for (const b of bloodStamps) {
            g.save();
            g.translate(b.x, b.y);
            g.rotate(b.rot);
            const grad = g.createRadialGradient(0, 0, 0, 0, 0, b.r);
            grad.addColorStop(0, rgba(theme.blood, 0.35));
            grad.addColorStop(0.6, rgba(theme.blood, 0.22));
            grad.addColorStop(1, rgba(theme.blood, 0));
            g.fillStyle = grad;
            g.beginPath();
            g.ellipse(0, 0, b.r, b.r * 0.62, 0, 0, TAU);
            g.fill();
            g.restore();
        }
    }

    function drawExitGround(g) {
        if (!exitZone) { return; }
        const t = performance.now() / 1000;
        g.save();
        if (exitZone.active) {
            const r = exitZone.r;
            const pulse = 0.6 + Math.sin(t * 2.4) * 0.2;
            const grad = g.createRadialGradient(exitZone.x, exitZone.y, 0, exitZone.x, exitZone.y, r * 1.5);
            grad.addColorStop(0, 'rgba(80,255,160,0.16)');
            grad.addColorStop(0.55, 'rgba(60,220,140,0.08)');
            grad.addColorStop(1, 'rgba(60,220,140,0)');
            g.fillStyle = grad;
            g.beginPath();
            g.ellipse(exitZone.x, exitZone.y, r * 1.5, r * 1.5, 0, 0, TAU);
            g.fill();
            g.strokeStyle = 'rgba(110,255,180,' + (0.35 + pulse * 0.25) + ')';
            g.lineWidth = 3;
            g.setLineDash([14, 12]);
            g.lineDashOffset = -t * 24;
            g.beginPath();
            g.arc(exitZone.x, exitZone.y, r, 0, TAU);
            g.stroke();
            g.setLineDash([]);
            g.strokeStyle = 'rgba(150,255,200,0.16)';
            g.lineWidth = 2;
            g.beginPath();
            g.arc(exitZone.x, exitZone.y, r * 0.7, 0, TAU);
            g.stroke();
        } else {
            g.strokeStyle = 'rgba(255,120,90,0.2)';
            g.lineWidth = 2;
            g.setLineDash([10, 12]);
            g.beginPath();
            g.arc(exitZone.x, exitZone.y, exitZone.r * 0.8, 0, TAU);
            g.stroke();
            g.setLineDash([]);
        }
        g.restore();
    }

    function drawExitObject(g) {
        if (!exitZone) { return; }
        const e = exitZone;
        const t = performance.now() / 1000;
        const active = e.active;
        g.save();
        g.translate(e.x, e.y);

        if (e.type === 'truck') {
            g.fillStyle = 'rgba(0,0,0,0.38)';
            roundRect(g, -88, -38, 184, 92, 14);
            g.fill();
            // 救援卡车车身
            const grad = g.createLinearGradient(0, -46, 0, 46);
            grad.addColorStop(0, '#c6cec0');
            grad.addColorStop(0.42, '#93a294');
            grad.addColorStop(1, '#5d6d61');
            g.fillStyle = grad;
            roundRect(g, -96, -46, 174, 92, 10);
            g.fill();
            g.strokeStyle = 'rgba(10,14,12,0.7)';
            g.lineWidth = 2;
            g.stroke();
            // 绿色救援条与红条
            g.fillStyle = 'rgba(61,112,86,0.85)';
            g.fillRect(-84, -30, 148, 10);
            g.fillStyle = 'rgba(176,59,47,0.7)';
            g.fillRect(-84, 20, 148, 5);
            // 驾驶舱
            g.fillStyle = 'rgba(22,36,38,0.9)';
            roundRect(g, -88, -36, 42, 72, 6);
            g.fill();
            g.fillStyle = 'rgba(150,215,220,0.20)';
            g.fillRect(-83, -31, 32, 14);
            g.fillStyle = 'rgba(150,215,220,0.12)';
            g.fillRect(-83, 7, 32, 14);
            // 后厢门 / 内部绿灯
            g.fillStyle = 'rgba(22,28,24,0.72)';
            g.fillRect(50, -36, 20, 72);
            g.fillStyle = active ? 'rgba(100,255,170,0.55)' : 'rgba(35,40,35,0.8)';
            g.fillRect(64, -32, 8, 64);
            g.strokeStyle = active ? 'rgba(130,255,190,0.8)' : 'rgba(120,120,110,0.4)';
            g.lineWidth = 2;
            g.strokeRect(64, -32, 8, 64);
            // 顶灯
            g.fillStyle = '#333835';
            g.fillRect(-26, -9, 28, 10);
            const blink = active && Math.sin(t * 8) > 0;
            g.fillStyle = blink ? 'rgba(110,255,180,0.95)' : 'rgba(60,120,90,0.45)';
            g.fillRect(-22, -6, 10, 6);
            g.fillStyle = 'rgba(255,230,180,0.45)';
            g.fillRect(-92, -9, 5, 18);
            // 车顶红十字
            g.fillStyle = 'rgba(240,240,230,0.85)';
            g.beginPath(); g.arc(-34, 0, 15, 0, TAU); g.fill();
            g.fillStyle = 'rgba(176,55,45,0.88)';
            g.fillRect(-38, -8, 8, 16);
            g.fillRect(-45, -1, 22, 7);
            // 字
            g.fillStyle = 'rgba(28,40,34,0.55)';
            g.font = '800 9px monospace';
            g.textAlign = 'left';
            g.fillText('RESCUE 06', -82, 40);
            // 轮子
            g.fillStyle = '#161918';
            roundRect(g, -68, -54, 24, 12, 4); g.fill();
            roundRect(g, -68, 42, 24, 12, 4); g.fill();
            roundRect(g, 28, -54, 24, 12, 4); g.fill();
            roundRect(g, 28, 42, 24, 12, 4); g.fill();
            g.fillStyle = 'rgba(200,205,190,0.25)';
            g.fillRect(-60, -54, 8, 2);
            g.fillRect(36, -54, 8, 2);
        } else if (e.type === 'bus') {
            g.fillStyle = 'rgba(0,0,0,0.38)';
            roundRect(g, -126, -42, 252, 96, 12);
            g.fill();
            const grad = g.createLinearGradient(0, -52, 0, 52);
            grad.addColorStop(0, '#435a52');
            grad.addColorStop(0.5, '#2f423c');
            grad.addColorStop(1, '#1f2c28');
            g.fillStyle = grad;
            roundRect(g, -128, -50, 250, 100, 8);
            g.fill();
            g.strokeStyle = 'rgba(8,12,10,0.7)';
            g.lineWidth = 3;
            g.stroke();
            g.fillStyle = 'rgba(150,230,190,' + (active ? 0.32 : 0.1) + ')';
            for (let i = 0; i < 6; i++) {
                g.fillRect(-110 + i * 36, -40, 24, 16);
            }
            g.fillStyle = 'rgba(215,225,210,0.55)';
            g.fillRect(-118, 12, 230, 6);
            g.fillStyle = active ? 'rgba(110,255,175,0.6)' : 'rgba(80,80,72,0.5)';
            g.fillRect(104, -24, 12, 48);
            g.fillStyle = '#151817';
            roundRect(g, -100, -58, 26, 12, 4); g.fill();
            roundRect(g, 60, -58, 26, 12, 4); g.fill();
            roundRect(g, -100, 46, 26, 12, 4); g.fill();
            roundRect(g, 60, 46, 26, 12, 4); g.fill();
        } else if (e.type === 'gate') {
            g.fillStyle = 'rgba(0,0,0,0.4)';
            g.fillRect(-78, -66, 172, 136);
            g.fillStyle = shade(theme.concrete, -0.12);
            g.fillRect(-86, -74, 172, 148);
            g.fillStyle = shade(theme.concrete, 0.1);
            g.fillRect(-74, -62, 148, 124);
            g.fillStyle = '#202523';
            g.fillRect(-56, -48, 112, 100);
            // 卷帘门横纹
            g.strokeStyle = 'rgba(130,140,130,0.2)';
            g.lineWidth = 2;
            for (let sy = -44; sy < 48; sy += 8) {
                g.beginPath(); g.moveTo(-52, sy); g.lineTo(52, sy); g.stroke();
            }
            g.fillStyle = active ? 'rgba(110,255,175,0.55)' : 'rgba(255,95,70,0.35)';
            g.beginPath();
            g.arc(-56, -58, 7, 0, TAU);
            g.fill();
            g.fillStyle = 'rgba(220,230,215,0.7)';
            g.font = '700 13px "PingFang SC","Microsoft YaHei",sans-serif';
            g.textAlign = 'center';
            g.fillText(active ? '撤离通道' : '封锁', 0, -54);
        } else if (e.type === 'stairs') {
            g.fillStyle = 'rgba(0,0,0,0.4)';
            g.fillRect(-68, -58, 156, 124);
            g.fillStyle = shade(theme.concrete, -0.18);
            g.fillRect(-76, -66, 152, 132);
            // 台阶
            for (let i = 0; i < 7; i++) {
                g.fillStyle = shade(theme.concrete, 0.1 - i * 0.045);
                g.fillRect(-58 + i * 8, -48 + i * 5, 116 - i * 16, 92 - i * 10);
            }
            g.fillStyle = 'rgba(6,10,10,0.8)';
            g.fillRect(-20, -12, 40, 30);
            g.strokeStyle = 'rgba(200,205,190,0.3)';
            g.lineWidth = 2;
            g.strokeRect(-62, -52, 124, 100);
            g.fillStyle = active ? 'rgba(110,255,175,0.85)' : 'rgba(255,95,70,0.5)';
            g.font = '700 12px "PingFang SC","Microsoft YaHei",sans-serif';
            g.textAlign = 'center';
            g.fillText('EXIT', 0, -54);
        } else if (e.type === 'heli') {
            g.save();
            g.scale(1.06, 1.06);
            g.rotate(Math.PI / 2);
            // 旋翼下洗气流
            for (let i = 0; i < 3; i++) {
                const ph = eucMod(t * 0.3 + i * 0.33, 1);
                g.strokeStyle = 'rgba(190,210,195,' + ((1 - ph) * 0.12) + ')';
                g.lineWidth = 2;
                g.beginPath(); g.ellipse(0, 0, 80 + ph * 120, 60 + ph * 90, 0, 0, TAU); g.stroke();
            }
            // 阴影
            g.fillStyle = 'rgba(0,0,0,0.34)';
            g.beginPath(); g.ellipse(18, 20, 68, 92, -0.12, 0, TAU); g.fill();
            g.rotate(-0.12);
            // 尾梁
            g.fillStyle = '#39463a';
            g.fillRect(-12, 40, 24, 104);
            g.fillStyle = '#2b352c';
            g.fillRect(-30, 126, 60, 12);
            g.fillRect(-8, 112, 16, 34);
            g.strokeStyle = 'rgba(12,16,12,0.7)';
            g.lineWidth = 2;
            g.strokeRect(-12, 40, 24, 104);
            // 尾桨
            g.save();
            g.translate(0, 140);
            g.rotate(t * 2.2);
            g.globalAlpha = 0.3;
            g.strokeStyle = '#d8e2d4';
            g.lineWidth = 3;
            g.beginPath(); g.moveTo(-30, 0); g.lineTo(30, 0); g.stroke();
            g.restore();
            // 机身
            const grad = g.createLinearGradient(-32, -70, 32, 70);
            grad.addColorStop(0, '#4d5a49');
            grad.addColorStop(0.4, '#34412f');
            grad.addColorStop(1, '#151d16');
            g.fillStyle = grad;
            g.beginPath();
            g.moveTo(0, -76);
            g.bezierCurveTo(34, -76, 40, -52, 38, -10);
            g.bezierCurveTo(36, 30, 20, 56, 0, 60);
            g.bezierCurveTo(-20, 56, -36, 30, -38, -10);
            g.bezierCurveTo(-40, -52, -34, -76, 0, -76);
            g.closePath();
            g.fill();
            g.strokeStyle = 'rgba(8,12,9,0.72)';
            g.lineWidth = 3;
            g.stroke();
            // 座舱玻璃
            const glass = g.createLinearGradient(0, -70, 0, -18);
            glass.addColorStop(0, 'rgba(150,215,210,0.55)');
            glass.addColorStop(0.6, 'rgba(38,76,80,0.92)');
            glass.addColorStop(1, 'rgba(18,38,42,0.95)');
            g.fillStyle = glass;
            g.beginPath();
            g.ellipse(0, -43, 26, 31, 0, 0, TAU);
            g.fill();
            g.strokeStyle = 'rgba(12,24,26,0.6)';
            g.lineWidth = 2;
            g.stroke();
            g.fillStyle = 'rgba(220,245,240,0.20)';
            g.beginPath(); g.ellipse(-8, -54, 10, 15, -0.4, 0, TAU); g.fill();
            // 机身白条与医疗标识
            g.fillStyle = 'rgba(220,225,205,0.42)';
            g.fillRect(-36, 4, 72, 5);
            g.fillStyle = 'rgba(200,70,60,0.75)';
            g.fillRect(-12, 16, 24, 7);
            g.fillRect(-4.5, 9, 9, 21);
            g.fillStyle = 'rgba(225,230,215,0.5)';
            g.font = '700 8px monospace';
            g.textAlign = 'center';
            g.fillText('RESCUE', 0, 33);
            // 舱门
            g.strokeStyle = 'rgba(20,26,20,0.7)';
            g.lineWidth = 2;
            g.strokeRect(18, -18, 14, 30);
            g.fillStyle = '#333d31';
            g.fillRect(20, -15, 10, 24);
            // 起落架
            g.fillStyle = '#1a1f1a';
            roundRect(g, -55, -20, 8, 78, 4);
            g.fill();
            roundRect(g, 47, -20, 8, 78, 4);
            g.fill();
            g.fillRect(-55, -20, 110, 6);
            g.fillRect(-55, 52, 110, 6);
            // 旋翼
            g.save();
            g.translate(0, -10);
            g.fillStyle = '#2a332b';
            g.beginPath(); g.arc(0, 0, 12, 0, TAU); g.fill();
            g.strokeStyle = 'rgba(180,195,175,0.07)';
            g.lineWidth = 5;
            g.beginPath(); g.arc(0, 0, 92, 0, TAU); g.stroke();
            g.rotate(t * 1.6);
            for (let i = 0; i < 2; i++) {
                g.rotate(Math.PI);
                const blades = g.createLinearGradient(0, 0, 120, 0);
                blades.addColorStop(0, 'rgba(28,34,28,0.65)');
                blades.addColorStop(1, 'rgba(28,34,28,0.08)');
                g.fillStyle = blades;
                g.beginPath();
                g.moveTo(6, -3);
                g.lineTo(124, -7);
                g.lineTo(128, 0);
                g.lineTo(124, 7);
                g.lineTo(6, 3);
                g.closePath();
                g.fill();
            }
            g.restore();
            // 航灯
            g.fillStyle = 'rgba(255,60,50,0.9)';
            g.beginPath(); g.arc(-48, 22, 3, 0, TAU); g.fill();
            g.fillStyle = 'rgba(70,255,140,0.9)';
            g.beginPath(); g.arc(48, 22, 3, 0, TAU); g.fill();
            g.fillStyle = Math.sin(t * 6) > 0 ? 'rgba(255,255,255,0.95)' : 'rgba(100,110,100,0.4)';
            g.beginPath(); g.arc(0, 136, 3, 0, TAU); g.fill();
            // 机头探照灯
            g.fillStyle = 'rgba(235,250,245,0.8)';
            g.beginPath(); g.arc(0, -70, 4, 0, TAU); g.fill();
            g.restore();
        }

        // 信号烟 / 绿色光柱
        if (active) {
            for (let i = 0; i < 4; i++) {
                const ph = eucMod(t * 0.18 + i * 0.25, 1);
                g.globalAlpha = (1 - ph) * 0.12;
                g.fillStyle = 'rgba(110,255,170,1)';
                g.beginPath();
                g.arc(54 + Math.sin(t * 0.8 + i * 2) * 14, 24 - ph * 90, 10 + ph * 30, 0, TAU);
                g.fill();
            }
            g.globalAlpha = 1;
            if (e.type !== 'heli') {
                g.fillStyle = 'rgba(110,255,170,0.9)';
                g.beginPath();
                g.moveTo(62, 38); g.lineTo(70, 20); g.lineTo(78, 38);
                g.closePath();
                g.fill();
                const fg = g.createRadialGradient(70, 28, 0, 70, 28, 34);
                fg.addColorStop(0, 'rgba(140,255,190,0.22)');
                fg.addColorStop(1, 'rgba(140,255,190,0)');
                g.fillStyle = fg;
                g.beginPath(); g.arc(70, 28, 34, 0, TAU); g.fill();
            }
        }
        g.restore();
    }

    function drawContainers(g) {
        const t = performance.now() / 1000;
        for (const c of containers) {
            const near = search.near === c;
            const hover = near && !c.opened;
            g.save();
            g.translate(c.x, c.y);
            // 影子
            g.fillStyle = 'rgba(0,0,0,0.32)';
            g.beginPath();
            g.ellipse(4, 6, 24, 15, 0, 0, TAU);
            g.fill();
            if (!c.opened) {
                const pulse = 0.5 + Math.sin(t * 2.6 + c.seed) * 0.5;
                const glow = g.createRadialGradient(0, 0, 0, 0, 0, 46);
                glow.addColorStop(0, rgba(LOOT[c.t].color, 0.16 + pulse * 0.10));
                glow.addColorStop(1, rgba(LOOT[c.t].color, 0));
                g.fillStyle = glow;
                g.beginPath(); g.arc(0, 0, 46, 0, TAU); g.fill();
                g.strokeStyle = rgba(LOOT[c.t].color, hover ? 0.9 : 0.35 + pulse * 0.2);
                g.lineWidth = hover ? 2.5 : 1.5;
                g.beginPath(); g.arc(0, 0, 25 + pulse * 2, 0, TAU); g.stroke();
            }
            drawContainerBody(g, c);
            if (!c.opened) {
                // 浮起的物资标记
                const bob = Math.sin(t * 2.2 + c.seed) * 4;
                g.translate(0, -38 + bob);
                g.fillStyle = LOOT[c.t].color;
                g.beginPath();
                g.moveTo(0, -7); g.lineTo(6, 0); g.lineTo(0, 7); g.lineTo(-6, 0);
                g.closePath();
                g.fill();
                g.strokeStyle = 'rgba(10,12,12,0.7)';
                g.lineWidth = 1.5;
                g.stroke();
                g.fillStyle = 'rgba(15,18,18,0.9)';
                g.fillRect(-1.5, -2, 3, 5);
            }
            g.restore();
        }
    }

    function drawContainerBody(g, c) {
        const opened = c.opened;
        if (c.t === 'crate') {
            g.save();
            if (opened) { g.rotate(0.12); }
            const grad = g.createLinearGradient(-18, -14, 18, 14);
            grad.addColorStop(0, '#9b7a4d');
            grad.addColorStop(1, '#5d4229');
            g.fillStyle = grad;
            g.fillRect(-18, -14, 36, 28);
            g.strokeStyle = 'rgba(38,26,16,0.8)';
            g.lineWidth = 2;
            g.strokeRect(-18, -14, 36, 28);
            g.strokeStyle = 'rgba(30,20,12,0.5)';
            g.lineWidth = 1;
            g.beginPath();
            g.moveTo(-16, -12); g.lineTo(16, 12);
            g.moveTo(16, -12); g.lineTo(-16, 12);
            g.stroke();
            g.fillStyle = 'rgba(225,205,165,0.22)';
            g.fillRect(-14, 8, 28, 3);
            if (opened) {
                g.fillStyle = 'rgba(20,14,10,0.6)';
                g.fillRect(-14, -12, 28, 14);
            }
            g.restore();
        } else if (c.t === 'military') {
            g.save();
            const grad = g.createLinearGradient(-20, -15, 20, 15);
            grad.addColorStop(0, '#5d6c57');
            grad.addColorStop(1, '#334034');
            g.fillStyle = grad;
            roundRect(g, -20, -15, 40, 30, 3);
            g.fill();
            g.strokeStyle = 'rgba(8,12,8,0.7)';
            g.lineWidth = 2;
            g.stroke();
            g.strokeStyle = 'rgba(150,190,230,0.55)';
            g.lineWidth = 1.5;
            g.strokeRect(-17, -12, 34, 24);
            g.fillStyle = 'rgba(160,205,245,0.7)';
            g.font = '700 8px monospace';
            g.textAlign = 'center';
            g.fillText('MIL', 0, 3);
            g.restore();
        } else if (c.t === 'med') {
            g.save();
            g.fillStyle = '#d7d9d2';
            roundRect(g, -18, -15, 36, 30, 4);
            g.fill();
            g.strokeStyle = 'rgba(50,55,52,0.6)';
            g.lineWidth = 2;
            g.stroke();
            g.fillStyle = '#c8454e';
            g.fillRect(-9, -3, 18, 6);
            g.fillRect(-3, -9, 6, 18);
            g.fillStyle = 'rgba(255,255,255,0.4)';
            g.fillRect(-16, -13, 32, 2);
            g.restore();
        } else if (c.t === 'trunk') {
            g.save();
            g.fillStyle = '#2b2c2a';
            roundRect(g, -20, -14, 40, 28, 4);
            g.fill();
            g.fillStyle = '#575c57';
            roundRect(g, -17, -11, 34, 22, 2);
            g.fill();
            g.fillStyle = 'rgba(0,0,0,0.5)';
            g.fillRect(-16, -9, 32, 10);
            if (opened) {
                g.save();
                g.rotate(-0.35);
                g.fillStyle = '#3c423d';
                g.fillRect(-17, -22, 34, 10);
                g.strokeStyle = 'rgba(150,160,150,0.3)';
                g.strokeRect(-17, -22, 34, 10);
                g.restore();
            }
            g.restore();
        } else if (c.t === 'gun') {
            g.save();
            const grad = g.createLinearGradient(-23, -13, 23, 13);
            grad.addColorStop(0, '#6f705b');
            grad.addColorStop(0.5, '#4b4d3d');
            grad.addColorStop(1, '#2f3228');
            g.fillStyle = grad;
            roundRect(g, -23, -13, 46, 26, 4);
            g.fill();
            g.strokeStyle = 'rgba(10,12,9,0.8)';
            g.lineWidth = 2;
            g.stroke();
            g.strokeStyle = 'rgba(255,210,130,0.32)';
            g.lineWidth = 1;
            g.strokeRect(-20, -10, 40, 20);
            // 长枪剪影
            g.strokeStyle = 'rgba(230,225,195,0.62)';
            g.lineWidth = 2;
            g.beginPath();
            g.moveTo(-16, -2);
            g.lineTo(8, -2);
            g.lineTo(8, 2);
            g.lineTo(-16, 2);
            g.moveTo(-16, -2);
            g.lineTo(-19, 3);
            g.moveTo(8, 0);
            g.lineTo(17, 0);
            g.stroke();
            g.fillStyle = 'rgba(255,210,130,0.75)';
            g.fillRect(-18, -10, 5, 5);
            g.fillRect(13, -10, 5, 5);
            g.fillStyle = 'rgba(255,210,130,0.55)';
            g.font = '700 7px monospace';
            g.textAlign = 'center';
            g.fillText('GUN', 0, 8);
            if (opened) {
                g.fillStyle = 'rgba(10,12,9,0.62)';
                g.fillRect(-19, -9, 38, 18);
                g.fillStyle = 'rgba(255,210,130,0.18)';
                g.fillRect(-15, -5, 30, 10);
            }
            g.restore();
        } else if (c.t === 'duffel') {
            g.save();
            const grad = g.createLinearGradient(-20, -12, 20, 12);
            grad.addColorStop(0, '#b8a27a');
            grad.addColorStop(1, '#6d5b3d');
            g.fillStyle = grad;
            roundRect(g, -21, -12, 42, 24, 10);
            g.fill();
            g.strokeStyle = 'rgba(50,40,26,0.7)';
            g.lineWidth = 2;
            g.stroke();
            g.strokeStyle = 'rgba(40,32,20,0.5)';
            g.beginPath();
            g.moveTo(-8, -11); g.lineTo(-8, 11);
            g.moveTo(8, -11); g.lineTo(8, 11);
            g.stroke();
            g.fillStyle = 'rgba(230,210,170,0.3)';
            g.fillRect(-18, -4, 8, 8);
            g.restore();
        }
    }

    function drawPickups(g) {
        const t = performance.now() / 1000;
        for (const p of pickups) {
            const bob = Math.sin(p.bob) * 3;
            const info = ITEM[p.type] || ITEM.armor;
            g.save();
            g.translate(p.x, p.y + bob);
            g.fillStyle = 'rgba(0,0,0,0.28)';
            g.beginPath();
            g.ellipse(2, 9 - bob, 13, 6, 0, 0, TAU);
            g.fill();
            const pulse = 0.7 + Math.sin(t * 4 + p.bob) * 0.3;
            const glow = g.createRadialGradient(0, 0, 0, 0, 0, 30);
            glow.addColorStop(0, rgba(info.color, 0.22 * pulse));
            glow.addColorStop(1, rgba(info.color, 0));
            g.fillStyle = glow;
            g.beginPath(); g.arc(0, 0, 30, 0, TAU); g.fill();
            g.fillStyle = info.color;
            if (p.type === 'medkit') {
                g.fillRect(-7, -7, 14, 14);
                g.fillStyle = 'rgba(30,20,24,0.85)';
                g.fillRect(-2, -5, 4, 10);
                g.fillRect(-5, -2, 10, 4);
            } else if (p.type === 'armor') {
                g.beginPath();
                g.moveTo(0, -8); g.lineTo(8, -3); g.lineTo(6, 7); g.lineTo(0, 9); g.lineTo(-6, 7); g.lineTo(-8, -3);
                g.closePath();
                g.fill();
                g.fillStyle = 'rgba(20,30,34,0.55)';
                g.fillRect(-2, -4, 4, 8);
            } else {
                g.fillRect(-6, -8, 12, 16);
                g.fillStyle = 'rgba(25,25,22,0.55)';
                g.fillRect(-6, -3, 12, 3);
            }
            g.restore();
        }
    }

    function drawCorpses(g) {
        for (const c of corpses) {
            const alpha = clamp(c.life / 5, 0, 1) * 0.9;
            g.save();
            g.globalAlpha = alpha;
            g.translate(c.x, c.y);
            g.rotate(c.angle);
            const def = ZOMBIE[c.kind];
            g.fillStyle = 'rgba(0,0,0,0.28)';
            g.beginPath(); g.ellipse(4, 5, c.r ? c.r * 1.8 : 30, 13, 0, 0, TAU); g.fill();
            g.fillStyle = shade(def.cloth, -0.2);
            roundRect(g, -def.r * 1.3, -def.r * 0.65, def.r * 2.5, def.r * 1.3, 8);
            g.fill();
            g.fillStyle = 'rgba(105,92,78,0.65)';
            g.beginPath();
            g.arc(def.r * 0.9, 0, def.r * 0.52, 0, TAU);
            g.fill();
            g.strokeStyle = 'rgba(120,80,64,0.5)';
            g.lineWidth = 4;
            g.lineCap = 'round';
            g.beginPath();
            g.moveTo(-def.r * 0.5, -def.r * 0.7);
            g.lineTo(def.r * 0.9, -def.r * 0.9);
            g.moveTo(-def.r * 0.5, def.r * 0.7);
            g.lineTo(def.r * 0.9, def.r * 0.9);
            g.stroke();
            g.restore();
        }
    }

    function drawFires(g) {
        const t = performance.now() / 1000;
        for (const f of fires) {
            const scale = clamp(f.r / 110, 0.55, 1.9);
            g.save();
            g.translate(f.x, f.y);
            // 烟
            for (let i = 0; i < 3; i++) {
                const ph = eucMod(t * 0.22 + i * 0.32 + f.seed, 1);
                g.globalAlpha = (1 - ph) * 0.10;
                g.fillStyle = 'rgba(40,36,32,1)';
                g.beginPath();
                g.arc(Math.sin(t * 0.7 + i * 2) * 16 * scale, -ph * 90 * scale, (12 + ph * 40) * scale, 0, TAU);
                g.fill();
            }
            g.globalAlpha = 1;
            // 火焰三层
            for (let layer = 0; layer < 3; layer++) {
                const flick = 0.8 + Math.sin(t * (8 + layer * 2) + f.seed + layer * 1.7) * 0.2;
                const w = (18 + layer * 8) * scale * flick;
                const h = (34 + layer * 13) * scale * flick;
                const grad = g.createRadialGradient(0, -h * 0.2, 0, 0, 0, h);
                if (layer === 0) {
                    grad.addColorStop(0, 'rgba(255,230,160,0.95)');
                    grad.addColorStop(0.4, 'rgba(255,150,60,0.75)');
                    grad.addColorStop(1, 'rgba(180,40,10,0)');
                } else {
                    grad.addColorStop(0, 'rgba(255,180,80,0.55)');
                    grad.addColorStop(0.5, 'rgba(220,70,20,0.35)');
                    grad.addColorStop(1, 'rgba(120,20,5,0)');
                }
                g.fillStyle = grad;
                g.beginPath();
                g.moveTo(-w, 4);
                g.quadraticCurveTo(-w * 0.6, -h * 0.45, Math.sin(t * 5 + layer) * w * 0.2, -h);
                g.quadraticCurveTo(w * 0.7, -h * 0.5, w, 4);
                g.closePath();
                g.fill();
            }
            // 火星
            for (let i = 0; i < 3; i++) {
                const ph = eucMod(t * (0.7 + i * 0.13) + i * 0.31 + f.seed, 1);
                g.globalAlpha = (1 - ph) * 0.7;
                g.fillStyle = '#ffb15c';
                g.fillRect(Math.sin(t * 2 + i * 3) * 22 * scale, -ph * 70 * scale, 1.5, 1.5);
            }
            g.globalAlpha = 1;
            g.restore();
        }
    }

    function drawActors(g) {
        const list = zombies.slice();
        // 简单的 y 排序，让人物在上下交叠时更自然
        list.sort((a, b) => a.y - b.y);
        for (const z of list) {
            if (z.dead) { continue; }
            drawZombie(g, z);
        }
        drawPlayer(g);
    }

    function drawPlayer(g) {
        if (player.dead) { drawPlayerCorpse(g); return; }
        const t = performance.now() / 1000;
        const aim = player.angle;
        const moveA = player.moveAngle;
        const recoil = player.recoil;

        g.save();
        g.translate(player.x, player.y);
        g.scale(1.24, 1.24);
        // 影子
        const sh = g.createRadialGradient(2, 4, 0, 2, 4, 23);
        sh.addColorStop(0, 'rgba(0,0,0,0.42)');
        sh.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = sh;
        g.beginPath(); g.ellipse(2, 4, 23, 14, 0, 0, TAU); g.fill();

        // 翻滚残影
        if (player.dodge > 0) {
            g.globalAlpha = 0.18;
            g.fillStyle = theme.accent;
            g.beginPath(); g.arc(0, 0, 20, 0, TAU); g.fill();
            g.globalAlpha = 1;
        }

        // 双腿
        g.save();
        g.rotate(moveA);
        const stride = Math.sin(player.walk) * 7 * player.walkAmp;
        const stride2 = Math.sin(player.walk + Math.PI) * 7 * player.walkAmp;
        drawLeg(g, stride, -5.5, player.dodge > 0);
        drawLeg(g, stride2, 5.5, player.dodge > 0);
        g.restore();

        // 背包
        g.save();
        g.rotate(aim);
        g.fillStyle = '#3d463a';
        roundRect(g, -22, -10, 14, 20, 5);
        g.fill();
        g.strokeStyle = 'rgba(15,18,14,0.7)';
        g.lineWidth = 2;
        g.stroke();
        g.fillStyle = 'rgba(180,160,110,0.2)';
        g.fillRect(-19, -7, 8, 3);
        g.fillRect(-19, 4, 8, 3);
        g.restore();

        // 躯干、手臂、武器、头
        g.save();
        g.rotate(aim);
        g.translate(-recoil * 1.2, 0);
        // 围巾 / 布条：给快速移动一点可读的拖尾
        g.fillStyle = 'rgba(178,74,48,0.82)';
        g.beginPath();
        g.moveTo(-4, -7);
        g.quadraticCurveTo(-16, -12 + Math.sin(t * 7) * 3, -26, -6 + Math.sin(t * 5) * 5);
        g.lineTo(-24, -1 + Math.sin(t * 5) * 5);
        g.quadraticCurveTo(-14, -5 + Math.sin(t * 7) * 3, -3, -3);
        g.closePath();
        g.fill();
        // 身体
        const bodyGrad = g.createLinearGradient(-8, -11, 10, 11);
        bodyGrad.addColorStop(0, '#74816e');
        bodyGrad.addColorStop(0.5, '#536052');
        bodyGrad.addColorStop(1, '#303a32');
        g.fillStyle = bodyGrad;
        roundRect(g, -9, -10, 22, 20, 8);
        g.fill();
        g.strokeStyle = 'rgba(10,14,12,0.8)';
        g.lineWidth = 2;
        g.stroke();
        // 战术背心
        g.fillStyle = '#2d3531';
        roundRect(g, -5, -8, 13, 16, 4);
        g.fill();
        g.strokeStyle = 'rgba(170,160,125,0.25)';
        g.lineWidth = 1.5;
        g.strokeRect(-4, -6, 11, 5);
        g.strokeRect(-4, 1, 11, 5);
        // 肩部
        g.fillStyle = '#4d5b4e';
        g.beginPath(); g.arc(0, -10, 5.5, 0, TAU); g.fill();
        g.beginPath(); g.arc(0, 10, 5.5, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.5)';
        g.lineWidth = 1.5;
        g.beginPath(); g.arc(0, -10, 5.5, 0, TAU); g.stroke();
        g.beginPath(); g.arc(0, 10, 5.5, 0, TAU); g.stroke();
        // 肩部橙色识别带
        g.fillStyle = 'rgba(196,92,58,0.85)';
        g.beginPath();
        g.arc(0, -10, 3.2, 0.25, Math.PI - 0.25);
        g.fill();
        g.strokeStyle = 'rgba(255,224,180,0.24)';
        g.lineWidth = 1.4;
        g.beginPath(); g.arc(0, 0, 11, Math.PI * 1.08, Math.PI * 1.72); g.stroke();

        drawPlayerArms(g, aim, recoil, t);
        drawGun(g, state.current, recoil, t);
        drawPlayerHead(g, aim, t);
        g.restore();

        // 受击闪红
        if (player.hurt > 0) {
            g.globalAlpha = player.hurt * 1.4;
            g.fillStyle = '#ff4d3d';
            g.beginPath(); g.arc(0, 0, 22, 0, TAU); g.fill();
            g.globalAlpha = 1;
        }
        g.restore();
    }

    function drawLeg(g, stride, side, rolling) {
        g.save();
        g.translate(stride, side);
        g.rotate(rolling ? 0.3 * side : Math.sin(player.walk) * 0.08 * side);
        g.strokeStyle = '#2c3430';
        g.lineWidth = 7;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(rolling ? 12 : 3, side * 1.4);
        g.stroke();
        g.fillStyle = '#171b18';
        g.beginPath();
        g.ellipse(rolling ? 14 : 5, side * 1.4, 5, 3.5, 0, 0, TAU);
        g.fill();
        g.restore();
    }

    function drawPlayerArms(g, aim, recoil, t) {
        const reloading = weapons[state.current].reloading > 0;
        const meleeOn = melee.anim > 0;
        g.lineCap = 'round';
        // 后手
        g.strokeStyle = '#39433a';
        g.lineWidth = 5.5;
        g.beginPath();
        if (meleeOn) {
            g.moveTo(-1, -9);
            g.lineTo(20, 10);
        } else if (reloading) {
            g.moveTo(-1, -9);
            g.lineTo(9, 11);
        } else {
            g.moveTo(-1, -9);
            g.lineTo(15, -3);
        }
        g.stroke();
        g.fillStyle = '#c69a6d';
        g.beginPath();
        if (meleeOn) { g.arc(20, 10, 3.4, 0, TAU); }
        else if (reloading) { g.arc(9, 11, 3.2, 0, TAU); }
        else { g.arc(15, -3, 3.2, 0, TAU); }
        g.fill();
        // 前手
        g.strokeStyle = '#4e5a4c';
        g.lineWidth = 5.5;
        g.beginPath();
        if (reloading) {
            g.moveTo(-1, 9);
            g.lineTo(4, 13);
        } else if (meleeOn) {
            g.moveTo(-1, 9);
            g.lineTo(31, 4);
        } else {
            g.moveTo(-1, 9);
            g.lineTo(20, 4);
        }
        g.stroke();
        g.fillStyle = '#d2a678';
        g.beginPath();
        if (reloading) { g.arc(4, 13, 3.2, 0, TAU); }
        else if (meleeOn) { g.arc(31, 4, 3.4, 0, TAU); }
        else { g.arc(20, 4, 3.2, 0, TAU); }
        g.fill();

        if (meleeOn) {
            g.save();
            g.translate(31, 4);
            g.rotate(-0.35);
            g.fillStyle = '#cfd6d2';
            g.beginPath();
            g.moveTo(0, -2); g.lineTo(18, -3); g.lineTo(22, 0); g.lineTo(18, 3); g.lineTo(0, 2);
            g.closePath();
            g.fill();
            g.fillStyle = '#5e4a34';
            g.fillRect(-5, -2.5, 6, 5);
            g.restore();
        }
    }

    function drawGun(g, key, recoil, t) {
        const w = WEAPONS[key] || WEAPONS.pistol;
        const reloading = weapons[key].reloading > 0;
        const bob = Math.sin(t * 2.2) * 0.6 * (1 - player.walkAmp * 0.5);
        g.save();
        g.translate(18 - recoil * 2.2, 5 + bob);
        if (reloading) { g.rotate(0.35); }
        g.lineCap = 'round';
        if (key === 'pistol') {
            g.fillStyle = '#2c2f2d';
            g.fillRect(-4, -3.5, 22, 7);
            g.fillStyle = '#4c534f';
            g.fillRect(-3, -2.5, 17, 3);
            g.fillStyle = '#1c1e1d';
            g.fillRect(1, 1, 6, 9);
            g.fillStyle = '#7f8782';
            g.fillRect(16, -2, 6, 4);
            g.fillStyle = '#c99a5b';
            g.fillRect(-3, 1, 2, 7);
        } else if (key === 'smg') {
            g.fillStyle = '#2c302e';
            g.fillRect(-10, -4, 34, 8);
            g.fillStyle = '#4a514d';
            g.fillRect(-8, -3, 27, 3);
            g.fillStyle = '#1c1f1e';
            g.fillRect(-2, 2, 7, 13);
            g.fillRect(-16, -2.5, 8, 5);
            g.fillStyle = '#8d938d';
            g.fillRect(22, -2, 9, 4);
            g.fillStyle = '#b8844d';
            g.fillRect(-11, 0, 3, 6);
        } else if (key === 'shotgun') {
            g.fillStyle = '#463a2c';
            g.fillRect(-18, -3, 20, 6);
            g.fillStyle = '#3c413f';
            g.fillRect(-2, -3.5, 28, 7);
            g.fillStyle = '#7d8580';
            g.fillRect(24, -2, 12, 4);
            g.fillStyle = '#262928';
            g.fillRect(2, 2, 7, 5);
            g.fillStyle = '#5e4a34';
            g.fillRect(8, 2, 10, 4);
            g.fillStyle = '#c99a5b';
            g.fillRect(-12, 1, 3, 5);
        } else {
            g.fillStyle = '#343937';
            g.fillRect(-16, -4, 40, 8);
            g.fillStyle = '#4e5550';
            g.fillRect(-12, -3, 32, 3);
            g.fillStyle = '#202322';
            g.fillRect(0, 2, 8, 12);
            g.fillRect(-16, -2.5, 7, 5);
            g.fillStyle = '#8f9791';
            g.fillRect(22, -2.5, 14, 4);
            g.fillStyle = '#252a27';
            g.fillRect(4, -7, 12, 4);
            g.fillStyle = '#c99a5b';
            g.fillRect(-8, 1, 3, 6);
        }
        // 手电
        g.fillStyle = '#242827';
        g.fillRect(w.len - 6, -4, 7, 5);
        g.fillStyle = 'rgba(255,235,180,0.4)';
        g.fillRect(w.len - 1, -3, 2, 2);
        g.restore();

        if (player.muzzle > 0.02) {
            g.save();
            g.translate(18 + w.len + 12, 5);
            const a = player.muzzle / 0.07;
            g.globalAlpha = a;
            const flashGrad = g.createRadialGradient(0, 0, 0, 0, 0, 30);
            flashGrad.addColorStop(0, 'rgba(255,245,200,0.9)');
            flashGrad.addColorStop(0.4, 'rgba(255,190,90,0.5)');
            flashGrad.addColorStop(1, 'rgba(255,120,30,0)');
            g.fillStyle = flashGrad;
            g.beginPath(); g.arc(0, 0, 30, 0, TAU); g.fill();
            g.fillStyle = 'rgba(255,240,190,0.9)';
            g.beginPath();
            g.moveTo(0, 0); g.lineTo(22, -7); g.lineTo(30, 0); g.lineTo(22, 7);
            g.closePath(); g.fill();
            g.restore();
        }
    }

    function drawPlayerHead(g, aim, t) {
        g.save();
        g.translate(7, 0);
        g.fillStyle = '#1b1f1c';
        g.beginPath(); g.arc(0, 0, 8, 0, TAU); g.fill();
        g.fillStyle = '#59675a';
        g.beginPath(); g.arc(-1, 0, 7.2, 0, TAU); g.fill();
        g.fillStyle = '#6e7c6c';
        g.beginPath(); g.arc(-2, -1.5, 5.2, 0, TAU); g.fill();
        // 护目镜
        g.fillStyle = 'rgba(30,42,48,0.9)';
        g.fillRect(1, -5, 5, 10);
        g.fillStyle = 'rgba(150,210,220,0.25)';
        g.fillRect(2, -4.5, 1.5, 9);
        // 面罩
        g.fillStyle = '#39443c';
        g.beginPath(); g.arc(5, 0, 3.6, -1.1, 1.1); g.fill();
        g.strokeStyle = 'rgba(255,220,160,0.35)';
        g.lineWidth = 1;
        g.beginPath(); g.arc(-1, 0, 7.2, Math.PI * 1.05, Math.PI * 1.75); g.stroke();
        g.restore();
    }

    function drawPlayerCorpse(g) {
        g.save();
        g.translate(player.x, player.y);
        g.rotate(player.angle + 0.4);
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.beginPath(); g.ellipse(4, 5, 26, 13, 0, 0, TAU); g.fill();
        g.fillStyle = '#3d473d';
        roundRect(g, -20, -10, 38, 20, 8);
        g.fill();
        g.fillStyle = '#59675a';
        g.beginPath(); g.arc(18, 0, 7, 0, TAU); g.fill();
        g.fillStyle = '#2c3430';
        g.fillRect(-24, -7, 12, 6);
        g.fillRect(-24, 1, 12, 6);
        g.restore();
    }

    function drawZombie(g, z) {
        const def = ZOMBIE[z.kind];
        const sway = Math.sin(z.walk) * 2.2;
        g.save();
        g.translate(z.x, z.y);
        g.scale(1.22, 1.22);
        g.fillStyle = 'rgba(0,0,0,0.34)';
        g.beginPath(); g.ellipse(3, 5, z.r * 1.5, z.r * 0.8, 0, 0, TAU); g.fill();

        g.rotate(z.angle);
        // 双腿
        g.strokeStyle = '#2f3631';
        g.lineWidth = z.kind === 'brute' ? 10 : 6.5;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(-2, -z.r * 0.45);
        g.lineTo(4 + Math.sin(z.walk) * 7, -z.r * 0.55);
        g.moveTo(-2, z.r * 0.45);
        g.lineTo(4 + Math.sin(z.walk + Math.PI) * 7, z.r * 0.55);
        g.stroke();
        // 躯干
        const bodyGrad = g.createLinearGradient(-z.r, -z.r, z.r, z.r);
        const cloth = def.cloth;
        bodyGrad.addColorStop(0, shade(cloth, 0.15));
        bodyGrad.addColorStop(1, shade(cloth, -0.3));
        g.fillStyle = bodyGrad;
        g.beginPath();
        g.ellipse(0, 0, z.r * 1.05, z.r * 0.82, 0, 0, TAU);
        g.fill();
        g.strokeStyle = 'rgba(12,16,12,0.7)';
        g.lineWidth = 2;
        g.stroke();
        // 破烂衣角
        g.fillStyle = shade(cloth, -0.18);
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * TAU + z.seed * 0.01;
            const rr = z.r * (0.55 + (i % 3) * 0.12);
            g.beginPath();
            g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
            g.lineTo(Math.cos(a + 0.24) * (rr + 7 + (i % 2) * 5), Math.sin(a + 0.24) * (rr + 5));
            g.lineTo(Math.cos(a + 0.5) * rr, Math.sin(a + 0.5) * rr);
            g.closePath();
            g.fill();
        }
        // 血污
        g.fillStyle = rgba(def.blood, 0.6);
        g.beginPath();
        g.ellipse(-z.r * 0.15, z.r * 0.2, z.r * 0.35, z.r * 0.24, 0.3, 0, TAU);
        g.fill();
        // 手臂
        const reach = z.bite > 0.3 ? 1.12 : 1;
        g.strokeStyle = shade(def.cloth, -0.12);
        g.lineWidth = z.kind === 'brute' ? 8 : 5;
        g.beginPath();
        g.moveTo(z.r * 0.1, -z.r * 0.75);
        g.lineTo(z.r * 0.85 * reach, -z.r * 0.95);
        g.lineTo(z.r * 1.55 * reach, -z.r * 0.55);
        g.moveTo(z.r * 0.1, z.r * 0.75);
        g.lineTo(z.r * 0.85 * reach, z.r * 0.95);
        g.lineTo(z.r * 1.55 * reach, z.r * 0.55);
        g.stroke();
        g.fillStyle = '#8c907c';
        g.beginPath(); g.arc(z.r * 1.55 * reach, -z.r * 0.55, z.r * 0.22, 0, TAU); g.fill();
        g.beginPath(); g.arc(z.r * 1.55 * reach, z.r * 0.55, z.r * 0.22, 0, TAU); g.fill();
        // 头
        g.fillStyle = '#171d19';
        g.beginPath(); g.arc(z.r * 0.76, 0, z.r * 0.63, 0, TAU); g.fill();
        const skin = z.kind === 'runner' ? '#7f8471' : z.kind === 'brute' ? '#666c5b' : '#747968';
        g.fillStyle = skin;
        g.beginPath(); g.arc(z.r * 0.75, 0, z.r * 0.56, 0, TAU); g.fill();
        g.fillStyle = 'rgba(196,198,166,0.55)';
        g.beginPath(); g.arc(z.r * 0.68, -z.r * 0.14, z.r * 0.34, 0, TAU); g.fill();
        // 乱发 / 溃烂
        g.fillStyle = 'rgba(28,32,26,0.55)';
        for (let i = 0; i < 5; i++) {
            const a = -1.3 + i * 0.55;
            g.beginPath();
            g.ellipse(z.r * (0.6 + Math.cos(a) * 0.3), Math.sin(a) * z.r * 0.5, 4, 2, a, 0, TAU);
            g.fill();
        }
        // 眼窝与红眼
        g.fillStyle = 'rgba(16,8,7,0.9)';
        g.beginPath(); g.arc(z.r * 0.98, -z.r * 0.19, z.r * 0.13, 0, TAU); g.fill();
        g.beginPath(); g.arc(z.r * 0.98, z.r * 0.19, z.r * 0.13, 0, TAU); g.fill();
        g.save();
        g.shadowColor = 'rgba(255,60,45,0.9)';
        g.shadowBlur = 7;
        g.fillStyle = 'rgba(255,88,62,0.95)';
        g.beginPath(); g.arc(z.r * 1.0, -z.r * 0.19, z.r * 0.055, 0, TAU); g.fill();
        g.beginPath(); g.arc(z.r * 1.0, z.r * 0.19, z.r * 0.055, 0, TAU); g.fill();
        g.restore();
        // 嘴 / 血
        g.fillStyle = 'rgba(30,10,8,0.9)';
        g.beginPath();
        g.ellipse(z.r * 1.14, 0, z.r * 0.18, z.r * 0.11, 0, 0, TAU);
        g.fill();
        g.fillStyle = 'rgba(110,28,20,0.7)';
        g.beginPath();
        g.ellipse(z.r * 1.18, z.r * 0.03, z.r * 0.10, z.r * 0.16, 0.3, 0, TAU);
        g.fill();
        if (z.bite > 0.4) {
            g.fillStyle = 'rgba(230,220,200,0.8)';
            g.fillRect(z.r * 1.06, -z.r * 0.09, z.r * 0.05, z.r * 0.05);
            g.fillRect(z.r * 1.16, -z.r * 0.02, z.r * 0.05, z.r * 0.05);
        }
        // 头部冷色轮廓
        g.strokeStyle = 'rgba(210,230,200,0.16)';
        g.lineWidth = 1.5;
        g.beginPath(); g.arc(z.r * 0.75, 0, z.r * 0.56, Math.PI * 1.05, Math.PI * 1.9); g.stroke();
        // 厚皮者护甲
        if (z.kind === 'brute') {
            g.fillStyle = 'rgba(70,66,52,0.85)';
            g.fillRect(-z.r * 0.5, -z.r * 0.95, z.r * 0.7, z.r * 0.4);
            g.fillRect(-z.r * 0.5, z.r * 0.55, z.r * 0.7, z.r * 0.4);
            g.strokeStyle = 'rgba(160,150,120,0.25)';
            g.strokeRect(-z.r * 0.5, -z.r * 0.95, z.r * 0.7, z.r * 0.4);
        }
        // 受击闪白
        if (z.hitFlash > 0) {
            g.globalAlpha = z.hitFlash * 5;
            g.fillStyle = 'rgba(255,235,220,0.8)';
            g.beginPath(); g.arc(0, 0, z.r * 1.1, 0, TAU); g.fill();
            g.globalAlpha = 1;
        }
        // 咬人前的红色警示
        if (z.windOn) {
            g.strokeStyle = 'rgba(255,90,60,' + (0.25 + Math.sin(performance.now() / 90) * 0.15) + ')';
            g.lineWidth = 3;
            g.beginPath(); g.arc(0, 0, z.r + 12, -0.8, 0.8); g.stroke();
        }
        g.restore();
    }

    function drawBulletsAndTracers(g) {
        g.save();
        g.globalCompositeOperation = 'lighter';
        for (const b of bullets) {
            const len = 20;
            const a = Math.atan2(b.vy, b.vx);
            g.strokeStyle = 'rgba(255,230,170,0.75)';
            g.lineWidth = 2;
            g.beginPath();
            g.moveTo(b.x - Math.cos(a) * len, b.y - Math.sin(a) * len);
            g.lineTo(b.x, b.y);
            g.stroke();
            g.fillStyle = 'rgba(255,245,210,0.95)';
            g.beginPath(); g.arc(b.x, b.y, 1.6, 0, TAU); g.fill();
        }
        g.restore();
    }

    function drawParticles(g) {
        for (const p of particles) {
            const alpha = clamp(p.life / p.max, 0, 1);
            g.globalAlpha = alpha;
            if (p.kind === 'blood') {
                g.fillStyle = p.color;
                g.beginPath();
                g.arc(p.x, p.y, p.size, 0, TAU);
                g.fill();
            } else if (p.kind === 'casing') {
                g.save();
                g.translate(p.x, p.y);
                g.rotate(p.rot);
                g.fillStyle = p.color;
                g.fillRect(-2, -1, 4, 2);
                g.restore();
            } else if (p.kind === 'spark') {
                g.fillStyle = p.color;
                g.beginPath(); g.arc(p.x, p.y, p.size, 0, TAU); g.fill();
            } else if (p.kind === 'dust' || p.kind === 'smoke') {
                g.fillStyle = p.color;
                g.beginPath(); g.arc(p.x, p.y, p.size, 0, TAU); g.fill();
            }
        }
        g.globalAlpha = 1;
    }

    function drawInteraction(g) {
        if (state.cinematic || !state.active) { return; }
        if (search.near && !search.near.opened) {
            const c = search.near;
            const target = search.target === c;
            const p = target ? clamp(search.timer / c.time, 0, 1) : 0;
            g.save();
            g.translate(c.x, c.y);
            g.strokeStyle = 'rgba(255,235,190,0.35)';
            g.lineWidth = 4;
            g.beginPath(); g.arc(0, 0, 32, 0, TAU); g.stroke();
            if (p > 0) {
                g.strokeStyle = LOOT[c.t].color;
                g.beginPath();
                g.arc(0, 0, 32, -Math.PI / 2, -Math.PI / 2 + p * TAU);
                g.stroke();
            }
            // 按键提示
            g.fillStyle = 'rgba(10,14,15,0.82)';
            roundRect(g, -22, -56, 44, 20, 5);
            g.fill();
            g.strokeStyle = 'rgba(255,225,180,0.35)';
            g.lineWidth = 1;
            g.stroke();
            g.fillStyle = '#ffe3ad';
            g.font = '600 11px "PingFang SC","Microsoft YaHei",sans-serif';
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.fillText('按住 E', 0, -46);
            g.restore();
        }
    }

    function drawFloaters(g) {
        for (const f of floaters) {
            const alpha = clamp(f.life / f.max, 0, 1);
            g.globalAlpha = alpha;
            g.fillStyle = f.color;
            g.font = '700 14px "PingFang SC","Microsoft YaHei",sans-serif';
            g.textAlign = 'center';
            g.shadowColor = 'rgba(0,0,0,0.8)';
            g.shadowBlur = 4;
            g.fillText(f.text, f.x, f.y);
            g.shadowBlur = 0;
        }
        g.globalAlpha = 1;
    }

    // ============================================================ 光照
    function drawLighting() {
        const now = performance.now() / 1000;
        const baseDark = level.key === 'subway' ? 0.5 : (level.key === 'quarantine' ? 0.10 : 0);
        const night = state.phase === 'night' ? state.nightFade : 0;
        const dark = clamp(Math.max(baseDark, night * 0.82), 0, 0.86);
        if (dark < 0.02) { return; }
        const lw = lightCanvas.width;
        const lh = lightCanvas.height;
        const lg = lightCtx;
        lg.setTransform(1, 0, 0, 1, 0, 0);
        lg.clearRect(0, 0, lw, lh);
        lg.setTransform(lw / (view.w * view.scale), 0, 0, lh / (view.h * view.scale), 0, 0);
        lg.globalCompositeOperation = 'source-over';
        lg.fillStyle = rgba(theme.night, dark);
        lg.fillRect(0, 0, view.w * view.scale, view.h * view.scale);

        const toScreen = (x, y) => ({
            x: (x - cam.x) * view.scale + cam.shakeX,
            y: (y - cam.y) * view.scale + cam.shakeY
        });

        lg.globalCompositeOperation = 'destination-out';
        // 路灯 / 荧光灯 / 火光 / 招牌
        for (const l of lights) {
            const head = lightHead(l);
            const p = toScreen(head.x, head.y);
            let radius = l.r || 220;
            let strength = 1;
            if (l.t === 'street') { radius = 250; strength = night > 0.05 ? 0.85 : 0.15; }
            else if (l.t === 'fluoro' || l.t === 'tube') { radius = 300; strength = 0.9; }
            else if (l.t === 'flood') { radius = l.r || 300; strength = 0.9; }
            else if (l.t === 'sign') { radius = 150; strength = 0.55; }
            else if (l.t === 'fire') { radius = l.r || 140; strength = 0.95; }
            else if (l.t === 'canopy') { radius = 380; strength = 0.9; }
            else if (l.t === 'searchlight') { radius = l.r || 380; strength = 0.8; }
            radius *= view.scale;
            if (l.t === 'street' && night < 0.05) { strength = 0.1; }
            if (l.t === 'sign' && night < 0.05) { strength = 0.3; }
            if (l.t === 'searchlight') {
                const ang = now * 0.35 + l.seed;
                const cx = p.x + Math.cos(ang) * radius * 0.55;
                const cy = p.y + Math.sin(ang) * radius * 0.55;
                const grad = lg.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.6);
                grad.addColorStop(0, 'rgba(255,255,255,' + (0.9 * strength) + ')');
                grad.addColorStop(1, 'rgba(255,255,255,0)');
                lg.fillStyle = grad;
                lg.beginPath(); lg.arc(cx, cy, radius * 0.6, 0, TAU); lg.fill();
                continue;
            }
            const flicker = (l.t === 'fire' || l.t === 'tube') ? 0.94 + Math.sin(now * 3.7 + l.seed) * 0.04 + Math.sin(now * 8.1 + l.seed * 2) * 0.02 : 1;
            const grad = lg.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
            grad.addColorStop(0, 'rgba(255,255,255,' + (0.92 * strength * flicker) + ')');
            grad.addColorStop(0.5, 'rgba(255,255,255,' + (0.42 * strength * flicker) + ')');
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            lg.fillStyle = grad;
            lg.beginPath(); lg.arc(p.x, p.y, radius, 0, TAU); lg.fill();
        }

        // 玩家周身微光 + 手电
        const ps = toScreen(player.x, player.y);
        const auraR = 100 * view.scale;
        const aura = lg.createRadialGradient(ps.x, ps.y, 0, ps.x, ps.y, auraR);
        aura.addColorStop(0, 'rgba(255,255,255,0.85)');
        aura.addColorStop(0.55, 'rgba(255,255,255,0.35)');
        aura.addColorStop(1, 'rgba(255,255,255,0)');
        lg.fillStyle = aura;
        lg.beginPath(); lg.arc(ps.x, ps.y, auraR, 0, TAU); lg.fill();

        const half = 0.44;
        const reach = 380 * view.scale;
        const torch = night > 0.02 ? 1 : (level.key === 'subway' ? 0.72 : 0.12);
        lg.save();
        lg.translate(ps.x, ps.y);
        lg.rotate(player.angle);
        const cone = lg.createRadialGradient(0, 0, 10, 0, 0, reach);
        cone.addColorStop(0, 'rgba(255,255,255,' + (0.88 * torch) + ')');
        cone.addColorStop(0.5, 'rgba(255,255,255,' + (0.35 * torch) + ')');
        cone.addColorStop(1, 'rgba(255,255,255,0)');
        lg.fillStyle = cone;
        lg.beginPath();
        lg.moveTo(0, 0);
        lg.arc(0, 0, reach, -half, half);
        lg.closePath();
        lg.fill();
        lg.restore();

        // 撤离点、枪口
        if (exitZone && exitZone.active) {
            const es = toScreen(exitZone.x, exitZone.y);
            const er = 240 * view.scale;
            const eg = lg.createRadialGradient(es.x, es.y, 0, es.x, es.y, er);
            eg.addColorStop(0, 'rgba(255,255,255,0.85)');
            eg.addColorStop(1, 'rgba(255,255,255,0)');
            lg.fillStyle = eg;
            lg.beginPath(); lg.arc(es.x, es.y, er, 0, TAU); lg.fill();
        }
        for (const f of flashes) {
            const fs = toScreen(f.x, f.y);
            const fr = f.r * view.scale;
            const fg = lg.createRadialGradient(fs.x, fs.y, 0, fs.x, fs.y, fr);
            fg.addColorStop(0, 'rgba(255,255,255,0.95)');
            fg.addColorStop(1, 'rgba(255,255,255,0)');
            lg.fillStyle = fg;
            lg.beginPath(); lg.arc(fs.x, fs.y, fr, 0, TAU); lg.fill();
        }

        lg.globalCompositeOperation = 'source-over';
        ctx.save();
        ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
        ctx.drawImage(lightCanvas, 0, 0, view.w * view.scale, view.h * view.scale);
        ctx.restore();

        // 加色泛光
        ctx.save();
        ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
        ctx.globalCompositeOperation = 'lighter';
        for (const l of lights) {
            const head = lightHead(l);
            const p = toScreen(head.x, head.y);
            let color = '#ffcf8a';
            let radius = (l.r || 220) * view.scale;
            let strength = 0.22;
            if (l.t === 'street') { color = '#ffc178'; strength = night > 0.05 ? 0.3 : 0.06; }
            else if (l.t === 'fluoro' || l.t === 'tube') { color = '#bff5ee'; strength = 0.28; }
            else if (l.t === 'flood') { color = '#e7f4ff'; strength = 0.32; }
            else if (l.t === 'sign') { color = l.color || '#ff6b8a'; radius = 110 * view.scale; strength = 0.2 + night * 0.18; }
            else if (l.t === 'fire') { color = '#ff8c42'; strength = 0.4; }
            else if (l.t === 'canopy') { color = '#ffdca4'; strength = 0.28; }
            else if (l.t === 'searchlight') {
                color = '#dfeeff';
                strength = 0.22;
                const ang = now * 0.35 + l.seed;
                const len = (l.r || 380) * view.scale * 1.4;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(ang);
                const beam = ctx.createLinearGradient(0, 0, len, 0);
                beam.addColorStop(0, 'rgba(220,240,255,0.16)');
                beam.addColorStop(0.6, 'rgba(210,235,255,0.07)');
                beam.addColorStop(1, 'rgba(210,235,255,0)');
                ctx.fillStyle = beam;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, len, -0.09, 0.09);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
            if (l.t === 'street' && night < 0.05) { strength = 0.04; }
            const flicker = (l.t === 'fire' || l.t === 'tube') ? 0.92 + Math.sin(now * 3.2 + l.seed) * 0.06 : 1;
            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
            grad.addColorStop(0, rgba(color, strength * flicker));
            grad.addColorStop(0.35, rgba(color, strength * 0.4 * flicker));
            grad.addColorStop(1, rgba(color, 0));
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, TAU); ctx.fill();
        }
        // 手电可见光锥
        const ps2 = toScreen(player.x, player.y);
        const reach2 = 380 * view.scale;
        ctx.save();
        ctx.translate(ps2.x, ps2.y);
        ctx.rotate(player.angle);
        const beam = ctx.createRadialGradient(0, 0, 10, 0, 0, reach2);
        const torchDay = night > 0.02 ? 1 : (level.key === 'subway' ? 0.7 : 0.10);
        beam.addColorStop(0, 'rgba(255,226,170,' + ((0.006 + night * 0.105) * torchDay) + ')');
        beam.addColorStop(0.6, 'rgba(255,214,150,' + ((0.003 + night * 0.04) * torchDay) + ')');
        beam.addColorStop(1, 'rgba(255,200,130,0)');
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, reach2, -half, half);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        // 撤离泛光
        if (exitZone && exitZone.active) {
            const es = toScreen(exitZone.x, exitZone.y);
            const er = 220 * view.scale;
            const pulse = 0.5 + Math.sin(now * 2.2) * 0.2;
            const grad = ctx.createRadialGradient(es.x, es.y, 0, es.x, es.y, er);
            grad.addColorStop(0, 'rgba(90,255,165,' + (0.20 + pulse * 0.12) + ')');
            grad.addColorStop(1, 'rgba(90,255,165,0)');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(es.x, es.y, er, 0, TAU); ctx.fill();
        }
        // 枪口闪光
        for (const f of flashes) {
            const fs = toScreen(f.x, f.y);
            const fr = f.r * view.scale;
            const grad = ctx.createRadialGradient(fs.x, fs.y, 0, fs.x, fs.y, fr);
            grad.addColorStop(0, 'rgba(255,230,160,0.35)');
            grad.addColorStop(1, 'rgba(255,180,90,0)');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(fs.x, fs.y, fr, 0, TAU); ctx.fill();
        }
        // 窗户、招牌的发光点
        for (const e of emissives) {
            if (e.power <= 0) { continue; }
            const p = toScreen(e.x, e.y);
            const rad = (e.w || 30) * 0.8 * view.scale;
            const a = night * e.power * 0.55;
            if (a <= 0.01) { continue; }
            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
            grad.addColorStop(0, rgba(e.color || '#ffc07a', a));
            grad.addColorStop(1, rgba(e.color || '#ffc07a', 0));
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, TAU); ctx.fill();
        }
        ctx.restore();
    }

    // ============================================================ 天气 / 后期
    function drawWeather() {
        const dpr = view.dpr;
        const cw = view.w * view.scale;
        const ch = view.h * view.scale;
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const night = state.phase === 'night' ? state.nightFade : 0;
        if (theme.weather === 'rain') {
            ctx.strokeStyle = 'rgba(185,215,230,' + (0.16 + night * 0.09) + ')';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (const m of ambient.motes) {
                ctx.moveTo(m.x, m.y);
                ctx.lineTo(m.x - 3, m.y + m.size);
            }
            ctx.stroke();
            // 地面雨点涟漪
            const tt = performance.now() / 1000;
            for (let i = 0; i < 26; i++) {
                const ph = eucMod(tt * 0.9 + i * 0.137, 1);
                const rx = ((i * 73.13) % 1) * cw;
                const ry = ((i * 37.77) % 1) * ch;
                ctx.strokeStyle = 'rgba(200,230,240,' + ((1 - ph) * 0.13) + ')';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.ellipse(rx, ry, 3 + ph * 14, (3 + ph * 14) * 0.36, 0, 0, TAU);
                ctx.stroke();
            }
        } else if (theme.weather === 'ember') {
            ctx.globalCompositeOperation = 'lighter';
            for (const m of ambient.motes) {
                ctx.fillStyle = 'rgba(255,150,70,' + (0.25 + Math.sin(m.life * 7) * 0.2) + ')';
                ctx.fillRect(m.x, m.y, m.size, m.size);
            }
            ctx.globalCompositeOperation = 'source-over';
        } else if (theme.weather === 'drip') {
            ctx.fillStyle = 'rgba(160,220,220,0.2)';
            for (const m of ambient.motes) {
                ctx.fillRect(m.x, m.y, 1, m.size);
            }
        } else {
            for (const m of ambient.motes) {
                ctx.fillStyle = 'rgba(215,205,185,' + (0.12 + night * 0.08) + ')';
                ctx.fillRect(m.x, m.y, m.size, m.size);
            }
        }
        // 薄雾
        if (fogTile) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.05 + night * 0.04;
            const t = performance.now() / 1000;
            for (let i = 0; i < 4; i++) {
                const x = eucMod(t * (4 + i * 2) + i * 400, cw + 500) - 250;
                const y = (i * 0.27 + 0.15) * ch + Math.sin(t * 0.16 + i) * 24;
                ctx.drawImage(fogTile, x, y, 460, 250);
            }
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
        }
        // 灯光下的雨丝更亮
        ctx.restore();
    }

    function drawScreenHints() {
        const dpr = view.dpr;
        const cw = view.w * view.scale;
        const ch = view.h * view.scale;
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const night = state.phase === 'night' ? state.nightFade : 0;
        if (night > 0.2 && exitZone && !state.cinematic && state.active) {
            const p = { x: (exitZone.x - cam.x) * view.scale + cam.shakeX, y: (exitZone.y - cam.y) * view.scale + cam.shakeY };
            if (p.x < 40 || p.x > cw - 40 || p.y < 60 || p.y > ch - 40) {
                const cx = cw / 2, cy = ch / 2;
                const a = Math.atan2(p.y - cy, p.x - cx);
                const rx = Math.min(cw / 2 - 42, ch / 2 - 60);
                const x = cx + Math.cos(a) * rx;
                const y = cy + Math.sin(a) * rx * 0.82;
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(a);
                ctx.fillStyle = 'rgba(110,255,180,' + (0.45 + Math.sin(performance.now() / 260) * 0.2) + ')';
                ctx.beginPath();
                ctx.moveTo(16, 0); ctx.lineTo(-8, -10); ctx.lineTo(-3, 0); ctx.lineTo(-8, 10);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
                const d = Math.round(dist(player.x, player.y, exitZone.x, exitZone.y) / 10);
                ctx.fillStyle = 'rgba(190,255,220,0.75)';
                ctx.font = '600 11px "PingFang SC","Microsoft YaHei",sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(d + 'm', x + Math.cos(a) * 30, y + Math.sin(a) * 30 + 4);
            }
        }
        // 关卡开场卡
        if (state.intro > 0 && !state.cinematic && state.active) {
            const total = 2.6;
            const p = 1 - state.intro / total;
            let alpha = 1;
            if (p < 0.1) { alpha = p / 0.1; }
            if (p > 0.82) { alpha = (1 - p) / 0.18; }
            ctx.globalAlpha = clamp(alpha, 0, 1);
            ctx.fillStyle = 'rgba(5,9,11,0.42)';
            ctx.fillRect(0, ch * 0.28, cw, 134);
            ctx.strokeStyle = 'rgba(255,220,170,0.14)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cw * 0.18, ch * 0.28); ctx.lineTo(cw * 0.82, ch * 0.28);
            ctx.moveTo(cw * 0.18, ch * 0.28 + 134); ctx.lineTo(cw * 0.82, ch * 0.28 + 134);
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,195,120,0.9)';
            ctx.font = '600 11px "PingFang SC","Microsoft YaHei",sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('区域 ' + String(state.level + 1).padStart(2, '0') + ' · ' + level.en, cw / 2, ch * 0.28 + 34);
            ctx.fillStyle = '#f4eadc';
            ctx.font = '700 34px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
            ctx.fillText(level.name, cw / 2, ch * 0.28 + 78);
            ctx.fillStyle = 'rgba(220,215,200,0.65)';
            ctx.font = '400 12px "PingFang SC","Microsoft YaHei",sans-serif';
            ctx.fillText((level.key === 'subway' ? '地下 ' : '白天 ') + level.time + ' 秒搜刮窗口 · 入夜后撤离', cw / 2, ch * 0.28 + 108);
            ctx.globalAlpha = 1;
        }

        // 受伤红边
        const low = player.hp <= 30 && !player.dead ? (0.5 + Math.sin(performance.now() / 280) * 0.2) : 0;
        const dmg = clamp(damageFlash.v * 0.55 + low * 0.16, 0, 1);
        if (dmg > 0.01) {
            const grad = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.22, cw / 2, ch / 2, Math.max(cw, ch) * 0.68);
            grad.addColorStop(0, 'rgba(150,10,10,0)');
            grad.addColorStop(1, 'rgba(150,10,10,' + dmg + ')');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, cw, ch);
        }
        ctx.restore();
    }

    function drawPost() {
        const dpr = view.dpr;
        const cw = view.w * view.scale;
        const ch = view.h * view.scale;
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        // 暗角
        const night = state.phase === 'night' ? state.nightFade : 0;
        if (night < 0.9) {
            const lift = (1 - night) * (level.key === 'subway' ? 0.02 : (level.key === 'quarantine' ? 0.045 : 0.075));
            ctx.globalCompositeOperation = 'screen';
            ctx.fillStyle = 'rgba(255,224,184,' + lift.toFixed(3) + ')';
            ctx.fillRect(0, 0, cw, ch);
            ctx.globalCompositeOperation = 'source-over';
            const sun = ctx.createRadialGradient(cw * 0.12, ch * 0.05, 0, cw * 0.12, ch * 0.05, Math.max(cw, ch) * 0.65);
            sun.addColorStop(0, 'rgba(255,205,140,' + (0.055 * (1 - night)).toFixed(3) + ')');
            sun.addColorStop(0.55, 'rgba(255,190,120,0.016)');
            sun.addColorStop(1, 'rgba(255,190,120,0)');
            ctx.globalCompositeOperation = 'screen';
            ctx.fillStyle = sun;
            ctx.fillRect(0, 0, cw, ch);
            ctx.globalCompositeOperation = 'source-over';
        }
        const grad = ctx.createRadialGradient(cw / 2, ch * 0.5, Math.min(cw, ch) * 0.34, cw / 2, ch * 0.5, Math.max(cw, ch) * 0.74);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(0.7, 'rgba(0,0,0,0.10)');
        grad.addColorStop(1, 'rgba(0,0,0,0.48)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, cw, ch);
        // 色调
        ctx.globalCompositeOperation = 'soft-light';
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = theme.haze;
        ctx.fillRect(0, 0, cw, ch);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        // 胶片颗粒：固定图案，不再逐帧随机偏移，避免整屏细碎闪烁
        if (!noiseTile) { noiseTile = makeNoiseTile(177, '#000000', '#ffffff', 160, 1800); }
        if (!grainPattern) { grainPattern = ctx.createPattern(noiseTile, 'repeat'); }
        if (grainPattern) {
            ctx.globalAlpha = 0.022;
            ctx.fillStyle = grainPattern;
            ctx.fillRect(0, 0, cw, ch);
        }
        ctx.globalAlpha = 1;
        // 上下暗带（电影感）
        const top = ctx.createLinearGradient(0, 0, 0, 70);
        top.addColorStop(0, 'rgba(3,6,8,0.55)');
        top.addColorStop(1, 'rgba(3,6,8,0)');
        ctx.fillStyle = top;
        ctx.fillRect(0, 0, cw, 70);
        const bottom = ctx.createLinearGradient(0, ch - 90, 0, ch);
        bottom.addColorStop(0, 'rgba(3,6,8,0)');
        bottom.addColorStop(1, 'rgba(3,6,8,0.5)');
        ctx.fillStyle = bottom;
        ctx.fillRect(0, ch - 90, cw, 90);
        ctx.restore();
    }

    function drawCrosshair() {
        if (isTouch || !pointer.active || !state.active || state.phase === 'dead' || state.cinematic) { return; }
        const dpr = view.dpr;
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const x = mouse.x, y = mouse.y;
        const w = WEAPONS[state.current];
        const moving = Math.hypot(player.vx, player.vy) / CFG.player.speed;
        const spread = 7 + w.spread * 130 + moving * 6 + player.recoil * 4;
        ctx.strokeStyle = 'rgba(255,230,190,0.78)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(x, y, spread, -0.6, 0.6);
        ctx.arc(x, y, spread, Math.PI - 0.6, Math.PI + 0.6);
        ctx.arc(x, y, spread, Math.PI / 2 - 0.6, Math.PI / 2 + 0.6);
        ctx.arc(x, y, spread, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,235,195,0.9)';
        ctx.beginPath(); ctx.arc(x, y, 1.6, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,235,195,0.2)';
        ctx.beginPath(); ctx.arc(x, y, spread + 7, 0, TAU); ctx.stroke();
        if (hitMarker.t > 0) {
            const hm = clamp(hitMarker.t / 0.16, 0, 1);
            ctx.strokeStyle = hitMarker.kill ? 'rgba(255,86,68,' + hm + ')' : 'rgba(255,240,215,' + hm + ')';
            ctx.lineWidth = 2;
            const r0 = 12, r1 = 20;
            for (let i = 0; i < 4; i++) {
                const a = Math.PI / 4 + i * Math.PI / 2;
                ctx.beginPath();
                ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
                ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    // ============================================================ HUD
    let overlayA = null;
    let overlayB = null;
    let lastHud = {};

    function buildSlots() {
        if (!ui || !ui.slots) { return; }
        ui.slots.innerHTML = '';
        WEAPON_ORDER.forEach((key, i) => {
            const slot = document.createElement('div');
            slot.className = 'wl-slot';
            slot.innerHTML = '<i>0' + (i + 1) + '</i><b>' + WEAPONS[key].name + '</b><em>' + WEAPONS[key].cn + '</em>';
            ui.slots.appendChild(slot);
        });
        if (ui.ammoTypes) {
            ui.ammoTypes.innerHTML = '';
            [['light', '9mm'], ['shell', '12G'], ['heavy', '5.56']].forEach(([type, label]) => {
                const chip = document.createElement('span');
                chip.className = 'wl-ammo-chip';
                chip.setAttribute('data-type', type);
                chip.innerHTML = '<i>' + label + '</i><b>0</b>';
                ui.ammoTypes.appendChild(chip);
            });
        }
    }

    function setText(el, text) {
        if (!el) { return; }
        if (el.textContent !== text) { el.textContent = text; }
    }

    function updateHud(force) {
        if (!ui) { return; }
        const hp = Math.max(0, Math.ceil(player.hp));
        const armor = Math.max(0, Math.round(player.armor));
        const hpPct = clamp(player.hp / CFG.player.hp, 0, 1);
        const armorPct = clamp(player.armor / CFG.player.armorMax, 0, 1);
        if (force || lastHud.hp !== hp) {
            lastHud.hp = hp;
            ui.hpFill.style.width = (hpPct * 100).toFixed(1) + '%';
            setText(ui.hpText, String(hp));
            ui.hpFill.parentNode.classList.toggle('is-low', hp <= 30);
        }
        if (force || lastHud.armor !== armor) {
            lastHud.armor = armor;
            ui.armorFill.style.width = (armorPct * 100).toFixed(1) + '%';
            setText(ui.armorText, String(armor));
        }
        const stam = Math.round(player.stamina);
        if (force || lastHud.stam !== stam) {
            lastHud.stam = stam;
            ui.staminaFill.style.width = (clamp(player.stamina / CFG.player.stamina, 0, 1) * 100).toFixed(1) + '%';
        }

        const dayLeft = Math.max(0, state.dayTimer);
        const mm = String(Math.floor(dayLeft / 60)).padStart(2, '0');
        const ss = String(Math.floor(dayLeft % 60)).padStart(2, '0');
        const timerText = state.phase === 'night' ? '撤离' : (mm + ':' + ss);
        if (force || lastHud.timer !== timerText) {
            lastHud.timer = timerText;
            setText(ui.timer, timerText);
        }
        const ringP = state.phase === 'night' ? 1 : clamp(dayLeft / Math.max(1, level.time), 0, 1);
        if (ui.clockRing) { ui.clockRing.style.setProperty('--p', ringP.toFixed(3)); }
        const phaseText = state.phase === 'night' ? '黑夜' : (state.phase === 'dead' ? '信号中断' : (level.key === 'subway' ? '地下' : '白天'));
        const phaseSub = state.phase === 'night' ? '撤离窗口' : (state.intro > 0 ? '准备' : '搜刮窗口');
        if (force || lastHud.phase !== phaseText) {
            lastHud.phase = phaseText;
            setText(ui.phase, phaseText);
            ui.clock.classList.toggle('is-night', state.phase === 'night');
        }
        if (force || lastHud.sub !== phaseSub) {
            lastHud.sub = phaseSub;
            setText(ui.phaseSub, phaseSub);
        }
        if (force || lastHud.clockLabel !== (state.phase === 'night' ? '撤离' : '搜刮')) {
            lastHud.clockLabel = state.phase === 'night' ? '撤离' : '搜刮';
            setText(ui.clockLabel, lastHud.clockLabel);
        }
        if (force || lastHud.level !== state.level) {
            lastHud.level = state.level;
            setText(ui.levelNo, String(state.level + 1).padStart(2, '0'));
            setText(ui.levelName, level.name);
        }

        const w = WEAPONS[state.current];
        const slot = weapons[state.current];
        if (force || lastHud.weapon !== state.current) {
            lastHud.weapon = state.current;
            setText(ui.weaponName, w.name);
            setText(ui.weaponCn, w.cn);
        }
        if (force || lastHud.mag !== slot.mag || lastHud.res !== ammo[w.ammo]) {
            lastHud.mag = slot.mag;
            lastHud.res = ammo[w.ammo];
            setText(ui.ammoMag, String(slot.mag));
            setText(ui.ammoRes, String(ammo[w.ammo]));
            ui.ammoMag.classList.toggle('is-empty', slot.mag === 0);
        }
        if (force || lastHud.reloading !== slot.reloading > 0) {
            lastHud.reloading = slot.reloading > 0;
            ui.reload.classList.toggle('is-on', slot.reloading > 0);
        }
        if (ui.reloadFill) {
            const rp = slot.reloading > 0 ? 1 - slot.reloading / Math.max(0.001, slot.reloadTime) : 0;
            ui.reloadFill.style.width = (clamp(rp, 0, 1) * 100).toFixed(0) + '%';
        }
        for (let i = 0; i < WEAPON_ORDER.length; i++) {
            const el = ui.slots.children[i];
            if (!el) { continue; }
            const key = WEAPON_ORDER[i];
            el.classList.toggle('is-owned', weapons[key].owned);
            el.classList.toggle('is-active', key === state.current);
        }
        if (ui.ammoTypes) {
            ['light', 'shell', 'heavy'].forEach((type, i) => {
                const chip = ui.ammoTypes.children[i];
                if (!chip) { return; }
                const hasGun = WEAPON_ORDER.some((k) => weapons[k].owned && WEAPONS[k].ammo === type);
                chip.querySelector('b').textContent = String(ammo[type]);
                chip.classList.toggle('is-useless', ammo[type] > 0 && !hasGun);
                chip.classList.toggle('is-empty', ammo[type] <= 0);
            });
        }

        if (force || lastHud.med !== medkits) {
            lastHud.med = medkits;
            setText(ui.medkits, String(medkits));
            ui.medkits.parentNode.classList.toggle('is-empty', medkits <= 0);
        }
        if (force || lastHud.opened !== state.opened) {
            lastHud.opened = state.opened;
            setText(ui.lootCount, String(state.opened));
            setText(ui.lootTotal, String(state.lootTotal));
        }

        // 撤离点状态
        let exitText;
        if (state.phase === 'night' && exitZone) {
            const d = Math.round(dist(player.x, player.y, exitZone.x, exitZone.y) / 10);
            exitText = '撤离点已开启 · ' + d + 'm';
        } else {
            exitText = '撤离点未开启';
        }
        if (force || lastHud.exit !== exitText) {
            lastHud.exit = exitText;
            setText(ui.exitText, exitText);
            ui.exitState.classList.toggle('is-open', state.phase === 'night');
        }

        // 搜刮提示
        const near = search.near;
        if (near && !near.opened && state.active) {
            ui.prompt.classList.remove('is-hidden');
            const p = search.target === near ? clamp(search.timer / near.time, 0, 1) : 0;
            ui.promptFill.style.width = (p * 100).toFixed(1) + '%';
            ui.prompt.classList.toggle('is-searching', p > 0);
            setText(ui.promptText, p > 0 ? '搜刮中 · ' + LOOT[near.t].name : '按住 E · 搜刮' + LOOT[near.t].name);
        } else {
            ui.prompt.classList.add('is-hidden');
        }

        if (force) {
            setText(ui.sound, audio.muted ? '音效关' : '音效开');
            ui.sound.classList.toggle('is-off', audio.muted);
            setText(ui.pause, state.paused ? '继续' : '暂停');
        }

        if (ui.damage) {
            const low = player.hp <= 30 && !player.dead && state.active ? 0.12 + Math.sin(performance.now() / 320) * 0.05 : 0;
            ui.damage.style.opacity = String(clamp(damageFlash.v * 0.7 + low, 0, 1));
        }

        ui.stage.classList.toggle('is-playing', state.active && !state.paused);
        ui.stage.classList.toggle('is-night', state.phase === 'night');
    }

    function drawMinimap() {
        if (!ui || !ui.minimap || !minimapBase) { return; }
        const c = ui.minimap;
        if (c.width !== minimapBase.width || c.height !== minimapBase.height) {
            c.width = minimapBase.width;
            c.height = minimapBase.height;
        }
        const g = c.getContext('2d');
        g.clearRect(0, 0, c.width, c.height);
        g.drawImage(minimapBase, 0, 0);
        const s = c.width / W;
        const t = performance.now() / 1000;
        // 物资
        for (const con of containers) {
            if (con.opened) { continue; }
            g.fillStyle = rgba(LOOT[con.t].color, 0.65 + Math.sin(t * 2 + con.seed) * 0.2);
            g.beginPath();
            g.arc(con.x * s, con.y * s, 1.8, 0, TAU);
            g.fill();
        }
        // 撤离点
        if (exitZone) {
            g.strokeStyle = exitZone.active ? 'rgba(110,255,175,0.95)' : 'rgba(255,120,90,0.7)';
            g.lineWidth = 1.8;
            g.beginPath();
            g.arc(exitZone.x * s, exitZone.y * s, exitZone.active ? 5 + Math.sin(t * 3) * 1.2 : 4, 0, TAU);
            g.stroke();
            g.fillStyle = exitZone.active ? 'rgba(110,255,175,0.8)' : 'rgba(255,120,90,0.5)';
            g.beginPath();
            g.arc(exitZone.x * s, exitZone.y * s, 1.6, 0, TAU);
            g.fill();
        }
        // 僵尸
        for (const z of zombies) {
            if (z.dead) { continue; }
            if (state.phase !== 'night' && dist(z.x, z.y, player.x, player.y) > 700) { continue; }
            g.fillStyle = z.kind === 'brute' ? 'rgba(255,110,80,0.95)' : 'rgba(255,90,80,0.7)';
            g.beginPath();
            g.arc(z.x * s, z.y * s, z.kind === 'brute' ? 2.4 : 1.5, 0, TAU);
            g.fill();
        }
        // 视野扇形 + 玩家
        const px = player.x * s, py = player.y * s;
        g.save();
        g.translate(px, py);
        g.rotate(player.angle);
        const cone = g.createLinearGradient(0, 0, 34, 0);
        cone.addColorStop(0, 'rgba(255,220,160,0.24)');
        cone.addColorStop(1, 'rgba(255,220,160,0)');
        g.fillStyle = cone;
        g.beginPath();
        g.moveTo(0, 0);
        g.arc(0, 0, 34, -0.5, 0.5);
        g.closePath();
        g.fill();
        g.fillStyle = '#ffe3a8';
        g.beginPath();
        g.moveTo(5, 0); g.lineTo(-3, -3.5); g.lineTo(-3, 3.5);
        g.closePath();
        g.fill();
        g.restore();
    }

    // ============================================================ 界面流程
    function buildLevelCards() {
        if (!ui || !ui.levels) { return; }
        ui.levels.innerHTML = '';
        LEVELS.forEach((L, i) => {
            const locked = i > state.unlocked;
            const rank = state.ranks[String(i)];
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'wl-level-card' + (locked ? ' is-locked' : '') + (i === state.selected ? ' is-active' : '');
            card.disabled = locked;
            card.innerHTML =
                '<em class="wl-lv-no">' + String(i + 1).padStart(2, '0') + '</em>' +
                '<strong>' + L.name + '</strong>' +
                '<span class="wl-lv-meta">' + (locked ? '未解锁' : (rank ? '最佳 ' + rank : '未通关')) + '</span>' +
                (rank ? '<i class="wl-lv-rank wl-rank-' + rank + '">' + rank + '</i>' : '');
            if (!locked) {
                card.addEventListener('click', () => {
                    initAudio();
                    SFX.click();
                    state.selected = i;
                    buildLevelCards();
                    updateOverlayStartLabel();
                });
            }
            ui.levels.appendChild(card);
        });
    }

    function updateOverlayStartLabel() {
        if (!ui || !ui.action) { return; }
        if (state.actionMode === 'levels') {
            const L = LEVELS[state.selected];
            ui.action.textContent = '进入 ' + String(state.selected + 1).padStart(2, '0') + ' · ' + L.name;
        }
    }

    function showLevelSelect() {
        if (ui && ui.hud) { ui.hud.classList.add('is-overlay'); }
        state.actionMode = 'levels';
        state.intro = 0;
        state.phase = 'idle';
        state.active = false;
        state.paused = true;
        state.selected = clamp(state.selected, 0, LEVELS.length - 1);
        if (ui) {
            ui.overlay.classList.remove('is-hidden');
            ui.overlay.classList.remove('is-end');
            ui.overlay.classList.add('is-levels');
            ui.overlayTitle.textContent = '废土余生';
            ui.overlayDesc.textContent = '白天搜刮，入夜撤离。\n六个区域，六张手工搭出的废墟地图：翻车壳、钻桥洞、穿商场、下地铁。\n每区入口附近都有枪械箱；沿流程进入下一区会继承装备，从关卡选择进入则重新开局。\n进度与评价保存在本地。';
            ui.levels.classList.remove('is-hidden');
            ui.grade.classList.add('is-hidden');
            ui.action2.classList.add('is-hidden');
            ui.foot.classList.remove('is-hidden');
            ui.pause.classList.add('is-hidden');
            buildLevelCards();
            updateOverlayStartLabel();
            overlayA = () => { startLevelInternal(state.selected); };
            overlayB = null;
        }
        updateHud(true);
    }

    function showPause() {
        if (!state.active || state.phase === 'dead' || state.phase === 'complete') { return; }
        state.paused = true;
        if (!ui) { return; }
        ui.hud.classList.add('is-overlay');
        state.actionMode = 'pause';
        ui.overlay.classList.remove('is-hidden');
        ui.overlay.classList.remove('is-end');
        ui.overlay.classList.add('is-levels');
        ui.overlayTitle.textContent = '已暂停';
        ui.overlayDesc.textContent = '第 ' + String(state.level + 1).padStart(2, '0') + ' 区 · ' + level.name + '\n剩余搜刮时间 ' + Math.ceil(state.dayTimer) + ' 秒 · 已搜刮 ' + state.opened + ' / ' + state.lootTotal;
        ui.levels.classList.add('is-hidden');
        ui.grade.classList.add('is-hidden');
        ui.action.textContent = '继续行动';
        ui.action2.textContent = '退出本次行动';
        ui.action2.classList.remove('is-hidden');
        ui.foot.classList.add('is-hidden');
        ui.pause.classList.remove('is-hidden');
        overlayA = () => { resumeGame(); };
        overlayB = () => { showLevelSelect(); };
        updateHud(true);
    }

    function resumeGame() {
        state.paused = false;
        hideOverlay();
        initAudio();
        updateHud(true);
    }

    function hideOverlay() {
        if (!ui) { return; }
        ui.hud.classList.remove('is-overlay');
        ui.overlay.classList.add('is-hidden');
        ui.overlay.classList.remove('is-end');
        ui.overlay.classList.remove('is-levels');
        ui.pause.classList.toggle('is-hidden', !state.active || state.phase === 'dead' || state.phase === 'complete');
    }

    function showEnd(success) {
        if (!ui) { return; }
        ui.hud.classList.add('is-overlay');
        state.actionMode = 'end';
        state.paused = false;
        ui.overlay.classList.remove('is-hidden');
        ui.overlay.classList.add('is-end');
        ui.overlay.classList.remove('is-levels');
        ui.levels.classList.add('is-hidden');
        ui.pause.classList.add('is-hidden');
        ui.grade.classList.remove('is-hidden');
        ui.foot.classList.remove('is-hidden');
        if (success) {
            const b = state.best || { rank: 'C', time: state.time, kills: state.kills, opened: state.opened, total: state.lootTotal };
            const secs = Math.max(1, Math.round(b.time));
            const mm = String(Math.floor(secs / 60)).padStart(2, '0');
            const ss = String(secs % 60).padStart(2, '0');
            ui.overlayTitle.textContent = state.level >= LEVELS.length - 1 ? '全境撤离' : '撤离成功';
            ui.overlayDesc.textContent = '区域 ' + String(state.level + 1).padStart(2, '0') + ' · ' + level.name + '\n' +
                '用时 ' + mm + ':' + ss + ' · 击杀 ' + b.kills + ' · 搜刮 ' + b.opened + ' / ' + b.total +
                (b.improved ? '\n评价已刷新' : '') + '\n' +
                (state.level >= LEVELS.length - 1 ? '最终装备：' : '会带入下一区：') + loadoutSummary();
            ui.grade.className = 'wl-grade wl-grade-' + b.rank;
            ui.grade.querySelector('b').textContent = b.rank;
            ui.grade.querySelector('span').textContent = b.rank === 'S' ? '完美撤离' : b.rank === 'A' ? '干净利落' : b.rank === 'B' ? '活着回来' : '下一次更好';
            const next = state.level + 1;
            const last = state.level >= LEVELS.length - 1;
            ui.action.textContent = last ? '再搜一次' : '进入下一区';
            ui.action2.textContent = '重新选择区域';
            ui.action2.classList.remove('is-hidden');
            overlayA = () => { startLevelInternal(last ? state.level : next, { carry: true }); };
            overlayB = () => { showLevelSelect(); };
        } else {
            ui.overlayTitle.textContent = '信号中断';
            ui.overlayDesc.textContent = '区域 ' + String(state.level + 1).padStart(2, '0') + ' · ' + level.name + '\n' +
                '你在撤离前倒下了。物资带不出去，但经验可以。';
            ui.grade.classList.add('is-hidden');
            ui.action.textContent = '重新部署';
            ui.action2.textContent = '选择区域';
            ui.action2.classList.remove('is-hidden');
            overlayA = () => { startLevelInternal(state.level, { checkpoint: true }); };
            overlayB = () => { showLevelSelect(); };
        }
        updateHud(true);
    }

    function onAction() {
        initAudio();
        SFX.click();
        if (overlayA) { overlayA(); }
    }

    function onAction2() {
        initAudio();
        SFX.click();
        if (overlayB) { overlayB(); }
    }

    function onSound() {
        toggleMute();
        setText(ui.sound, audio.muted ? '音效关' : '音效开');
        ui.sound.classList.toggle('is-off', audio.muted);
    }

    function onPause() {
        if (state.phase === 'day' || state.phase === 'night') {
            if (state.paused) { resumeGame(); } else { showPause(); }
        }
    }

    // ============================================================ 输入
    const bound = {};

    function isTypingTarget(target) {
        if (!target) { return false; }
        const tag = (target.tagName || '').toLowerCase();
        return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
    }

    function refreshPointerWorld() {
        pointer.worldX = cam.x + mouse.x / view.scale;
        pointer.worldY = cam.y + mouse.y / view.scale;
    }

    function onKeyDown(e) {
        if (isTypingTarget(e.target)) { return; }
        const code = e.code;
        const playing = state.phase === 'day' || state.phase === 'night';
        if (playing) {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(code) >= 0) {
                e.preventDefault();
            }
        }
        if (code === 'Escape') {
            if (state.paused && (state.phase === 'day' || state.phase === 'night')) { resumeGame(); }
            else if (playing) { showPause(); }
            return;
        }
        if (code === 'KeyM') { onSound(); return; }
        if (!playing) { return; }
        if (code === 'KeyW' || code === 'ArrowUp') { input.up = true; }
        else if (code === 'KeyS' || code === 'ArrowDown') { input.down = true; }
        else if (code === 'KeyA' || code === 'ArrowLeft') { input.left = true; }
        else if (code === 'KeyD' || code === 'ArrowRight') { input.right = true; }
        else if (code === 'ShiftLeft' || code === 'ShiftRight') { input.sprint = true; }
        else if (code === 'Space') { if (!e.repeat) { input.dodge = true; } }
        else if (code === 'KeyE') { input.search = true; }
        else if (code === 'KeyR') { if (!e.repeat) { input.reload = true; } }
        else if (code === 'KeyF') { if (!e.repeat) { input.heal = true; } }
        else if (code === 'KeyQ' || code === 'KeyV') { if (!e.repeat) { input.melee = true; } }
        else if (code === 'Digit1' || code === 'Digit2' || code === 'Digit3' || code === 'Digit4') {
            input.switchTo = Number(code.slice(-1));
        }
    }

    function onKeyUp(e) {
        const code = e.code;
        if (code === 'KeyW' || code === 'ArrowUp') { input.up = false; }
        else if (code === 'KeyS' || code === 'ArrowDown') { input.down = false; }
        else if (code === 'KeyA' || code === 'ArrowLeft') { input.left = false; }
        else if (code === 'KeyD' || code === 'ArrowRight') { input.right = false; }
        else if (code === 'ShiftLeft' || code === 'ShiftRight') { input.sprint = false; }
        else if (code === 'KeyE') { input.search = false; }
    }

    function onPointerMove(e) {
        if (e.pointerType === 'touch') { return; }
        if (isTouch && !touchDevice) {
            isTouch = false;
            if (ui && ui.touch) { ui.touch.classList.add('is-hidden'); }
            if (stage) { stage.classList.remove('is-touch'); }
        }
        const rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
        pointer.active = true;
    }

    function onPointerDown(e) {
        if (isTypingTarget(e.target)) { return; }
        if (e.target && e.target.closest && e.target.closest('button, .wl-overlay, .wl-touch, .wl-hud')) { return; }
        if (e.pointerType === 'touch') { return; }
        initAudio();
        if (e.button === 0) {
            input.fire = true;
            input.fireLatch = true;
        } else if (e.button === 2) {
            input.melee = true;
        }
    }

    function onPointerUp() {
        input.fire = false;
    }

    function onContextMenu(e) {
        if (state.active) { e.preventDefault(); }
    }

    function showTouchUi() {
        isTouch = true;
        if (ui && ui.touch) { ui.touch.classList.remove('is-hidden'); }
        if (stage) { stage.classList.add('is-touch'); }
    }

    function bindStick(el, knob, onChange) {
        if (!el) { return; }
        let id = null;
        const move = (e) => {
            const rect = el.getBoundingClientRect();
            let dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width * 0.38);
            let dy = (e.clientY - (rect.top + rect.height / 2)) / (rect.height * 0.38);
            const m = Math.hypot(dx, dy);
            if (m > 1) { dx /= m; dy /= m; }
            knob.style.transform = 'translate(' + (dx * 26) + 'px,' + (dy * 26) + 'px)';
            onChange(dx, dy);
            e.preventDefault();
        };
        el.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            id = e.pointerId;
            el.setPointerCapture(id);
            showTouchUi();
            move(e);
        });
        el.addEventListener('pointermove', (e) => {
            if (e.pointerId === id) { move(e); }
        });
        const end = (e) => {
            if (id !== null && e.pointerId !== id) { return; }
            id = null;
            knob.style.transform = 'translate(0px,0px)';
            onChange(0, 0);
            e.preventDefault();
        };
        el.addEventListener('pointerup', end);
        el.addEventListener('pointercancel', end);
        el.addEventListener('pointerleave', (e) => {
            if (id !== null && e.pointerId === id && e.buttons === 0) { end(e); }
        });
    }

    function bindTouchControls() {
        if (!ui || !ui.touch) { return; }
        bindStick(ui.stick, ui.stickKnob, (x, y) => {
            input.moveX = x;
            input.moveY = y;
        });
        bindStick(ui.aim, ui.aimKnob, (x, y) => {
            input.aimX = x;
            input.aimY = y;
            const m = Math.hypot(x, y);
            input.touchAim = m > 0.3;
            input.fire = m > 0.3;
        });
        if (ui.weaponCard) {
            ui.weaponCard.addEventListener('pointerdown', (e) => {
                if (!isTouch || !state.active) { return; }
                e.preventDefault();
                nextWeapon();
            });
        }
        ui.touch.querySelectorAll('[data-act]').forEach((btn) => {
            const act = btn.getAttribute('data-act');
            const down = (e) => {
                e.preventDefault();
                e.stopPropagation();
                initAudio();
                showTouchUi();
                if (act === 'search') { input.search = true; }
                else if (act === 'reload') { input.reload = true; }
                else if (act === 'heal') { input.heal = true; }
                else if (act === 'melee') { input.melee = true; }
                else if (act === 'dodge') { input.dodge = true; }
                else if (act === 'switch') { input.switchTo = ((WEAPON_ORDER.indexOf(state.current) + 1) % WEAPON_ORDER.length) + 1; }
            };
            const up = (e) => {
                e.preventDefault();
                if (act === 'search') { input.search = false; }
            };
            btn.addEventListener('pointerdown', down);
            btn.addEventListener('pointerup', up);
            btn.addEventListener('pointercancel', up);
            btn.addEventListener('pointerleave', up);
        });
        const firstTouch = () => {
            showTouchUi();
            document.removeEventListener('touchstart', firstTouch);
        };
        document.addEventListener('touchstart', firstTouch, { passive: true });
    }

    function bindInput() {
        bound.keydown = onKeyDown;
        bound.keyup = onKeyUp;
        bound.move = onPointerMove;
        bound.down = onPointerDown;
        bound.up = onPointerUp;
        bound.ctx = onContextMenu;
        bound.visibility = () => {
            if (document.hidden && state.active && !state.paused && (state.phase === 'day' || state.phase === 'night')) {
                showPause();
            }
            if (document.hidden) { input.fire = false; input.search = false; }
        };
        bound.blur = () => {
            input.up = input.down = input.left = input.right = false;
            input.fire = false;
            input.search = false;
            input.sprint = false;
        };
        window.addEventListener('keydown', bound.keydown);
        window.addEventListener('keyup', bound.keyup);
        window.addEventListener('pointermove', bound.move);
        window.addEventListener('pointerdown', bound.down);
        window.addEventListener('pointerup', bound.up);
        window.addEventListener('blur', bound.blur);
        stage.addEventListener('contextmenu', bound.ctx);
        document.addEventListener('visibilitychange', bound.visibility);
        bindTouchControls();
    }

    function unbindInput() {
        window.removeEventListener('keydown', bound.keydown);
        window.removeEventListener('keyup', bound.keyup);
        window.removeEventListener('pointermove', bound.move);
        window.removeEventListener('pointerdown', bound.down);
        window.removeEventListener('pointerup', bound.up);
        window.removeEventListener('blur', bound.blur);
        if (stage) { stage.removeEventListener('contextmenu', bound.ctx); }
        document.removeEventListener('visibilitychange', bound.visibility);
    }

    // ============================================================ 尺寸 / 循环
    function resize() {
        if (!stage || !canvas) { return; }
        const width = Math.max(280, Math.round(stage.clientWidth));
        const height = Math.max(200, Math.round(stage.clientHeight));
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        view.dpr = dpr;
        const mobile = width < 700;
        view.scale = clamp(height / (mobile ? 800 : CFG.viewH), 0.5, 1.45);
        view.w = width / view.scale;
        view.h = height / view.scale;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        if (!pointer.active) {
            mouse.x = width / 2;
            mouse.y = height / 2;
        }
        if (!lightCanvas) { lightCanvas = document.createElement('canvas'); }
        lightCanvas.width = Math.max(2, Math.round(width * 0.5));
        lightCanvas.height = Math.max(2, Math.round(height * 0.5));
        lightCtx = lightCanvas.getContext('2d');
        cam.x = clamp(cam.x, 0, Math.max(0, W - view.w));
        cam.y = clamp(cam.y, 0, Math.max(0, H - view.h));
        setupMinimap();
    }

    function setupMinimap() {
        if (!ui || !ui.minimap || !minimapBase) { return; }
        ui.minimap.width = minimapBase.width;
        ui.minimap.height = minimapBase.height;
    }

    function onResize() {
        resize();
    }

    function frame(now) {
        if (destroyed) { return; }
        if (!lastTime) { lastTime = now; }
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;
        clockTime += dt;
        fpsAccum += dt;
        fpsFrames++;
        if (fpsAccum >= 0.75) {
            fpsValue = Math.round(fpsFrames / fpsAccum);
            fpsAccum = 0;
            fpsFrames = 0;
        }
        if (!state.paused) {
            update(dt);
        }
        render();
        drawMinimap();
        updateHud(false);
        raf = window.requestAnimationFrame(frame);
    }

    // ============================================================ 挂载 / 销毁
    function cacheUi(el) {
        ui = {
            stage: el,
            canvas: el.querySelector('.wl-canvas'),
            hpFill: el.querySelector('#wl-hp-fill'),
            hpText: el.querySelector('#wl-hp-text'),
            armorFill: el.querySelector('#wl-armor-fill'),
            armorText: el.querySelector('#wl-armor-text'),
            staminaFill: el.querySelector('#wl-stamina-fill'),
            clock: el.querySelector('#wl-clock'),
            clockRing: el.querySelector('#wl-clock-ring'),
            clockLabel: el.querySelector('#wl-clock-label'),
            hud: el.querySelector('.wl-hud'),
            timer: el.querySelector('#wl-timer'),
            phase: el.querySelector('#wl-phase'),
            phaseSub: el.querySelector('#wl-phase-sub'),
            levelNo: el.querySelector('#wl-level-no'),
            levelName: el.querySelector('#wl-level-name'),
            exitText: el.querySelector('#wl-exit-text'),
            exitState: el.querySelector('#wl-exit-state'),
            weaponName: el.querySelector('#wl-weapon-name'),
            weaponCn: el.querySelector('#wl-weapon-cn'),
            ammoMag: el.querySelector('#wl-ammo-mag'),
            ammoRes: el.querySelector('#wl-ammo-res'),
            reload: el.querySelector('#wl-reload'),
            reloadFill: el.querySelector('#wl-reload-fill'),
            slots: el.querySelector('#wl-slots'),
            ammoTypes: el.querySelector('#wl-ammo-types'),
            medkits: el.querySelector('#wl-medkits'),
            lootCount: el.querySelector('#wl-loot-count'),
            lootTotal: el.querySelector('#wl-loot-total'),
            prompt: el.querySelector('#wl-prompt'),
            promptText: el.querySelector('#wl-prompt-text'),
            promptFill: el.querySelector('#wl-prompt-fill'),
            toasts: el.querySelector('#wl-toasts'),
            hint: el.querySelector('#wl-hint'),
            overlay: el.querySelector('#wl-overlay'),
            overlayTitle: el.querySelector('#wl-overlay-title'),
            overlayDesc: el.querySelector('#wl-overlay-desc'),
            levels: el.querySelector('#wl-levels'),
            grade: el.querySelector('#wl-grade'),
            action: el.querySelector('#wl-action'),
            action2: el.querySelector('#wl-action2'),
            foot: el.querySelector('#wl-overlay-foot'),
            sound: el.querySelector('#wl-sound'),
            pause: el.querySelector('#wl-pause'),
            minimap: el.querySelector('#wl-minimap'),
            damage: el.querySelector('#wl-damage'),
            touch: el.querySelector('#wl-touch'),
            stick: el.querySelector('#wl-stick'),
            stickKnob: el.querySelector('#wl-stick-knob'),
            aim: el.querySelector('#wl-aim'),
            aimKnob: el.querySelector('#wl-aim-knob'),
            tip: document.querySelector('.wl-tip'),
            weaponCard: el.querySelector('.wl-weapon-card')
        };
        if (!ui.canvas) {
            ui.canvas = document.createElement('canvas');
            ui.canvas.className = 'wl-canvas';
            el.insertBefore(ui.canvas, el.firstChild);
        }
        canvas = ui.canvas;
        ctx = canvas.getContext('2d');
        stage = el;
    }

    function mount(el) {
        root = el;
        cacheUi(el);
        buildSlots();
        loadProgress();
        resize();
        buildLevel(state.selected);
        setupMinimap();
        buildSlots();
        resize();

        touchDevice = !!(window.matchMedia && window.matchMedia('(hover: none), (pointer: coarse)').matches);
        if (touchDevice) {
            showTouchUi();
            if (ui.tip) {
                ui.tip.textContent = '左侧摇杆移动，右侧摇杆瞄准并自动射击；搜刮、换弹、用药、翻滚在右侧按钮，点弹药卡换枪。入口附近有枪械箱，装备会继承到下一区。白天 60–75 秒搜刮，入夜后跟着绿色信号烟撤离。';
            }
        }
        bindInput();
        ui.action.addEventListener('click', onAction);
        ui.action2.addEventListener('click', onAction2);
        ui.sound.addEventListener('click', onSound);
        ui.pause.addEventListener('click', onPause);

        if (window.ResizeObserver) {
            observer = new ResizeObserver(() => onResize());
            observer.observe(root);
        } else {
            window.addEventListener('resize', onResize);
        }

        showLevelSelect();
        updateHud(true);
        lastTime = 0;
        raf = window.requestAnimationFrame(frame);
        installDebugApi();
        return { destroy: destroy };
    }

    function installDebugApi() {
        if (typeof window === 'undefined') { return; }
        if (location.search.indexOf('wl-debug') < 0) { return; }
        window.__wastelandDebug = {
            start: (i) => startLevelInternal(i || 0),
            night: () => {
                if (state.phase === 'day') {
                    state.intro = 0;
                    state.dayTimer = 0;
                    startNight();
                    state.nightFade = 1;
                }
            },
            teleport: (x, y) => {
                player.x = clamp(x, 30, W - 30);
                player.y = clamp(y, 30, H - 30);
                cam.x = clamp(player.x - view.w / 2, 0, Math.max(0, W - view.w));
                cam.y = clamp(player.y - view.h / 2, 0, Math.max(0, H - view.h));
                updateNav(0, true);
            },
            openAll: () => { containers.forEach((c) => { if (!c.opened) { openContainer(c); } }); },
            win: () => { completeLevel(); },
            spawn: (n) => { for (let i = 0; i < (n || 5); i++) { spawnZombie(rollZombieKind()); } },
            spawnNear: (n) => {
                for (let i = 0; i < (n || 4); i++) {
                    const a = (i / Math.max(1, n || 4)) * TAU + rnd(0, 0.5);
                    const r = rnd(120, 240);
                    const z = spawnZombie(rollZombieKind());
                    const zz = zombies[zombies.length - 1];
                    zz.x = clamp(player.x + Math.cos(a) * r, 30, W - 30);
                    zz.y = clamp(player.y + Math.sin(a) * r, 30, H - 30);
                }
            },
            zombies: () => zombies.map((z) => ({ kind: z.kind, x: Math.round(z.x), y: Math.round(z.y), hp: Math.round(z.hp), dead: z.dead })),
            placeZombie: (kind, x, y) => {
                spawnZombie(kind || 'walker');
                const z = zombies[zombies.length - 1];
                z.x = x; z.y = y; z.angle = Math.PI;
                return true;
            },
            cinematic: () => { state.cinematic = true; },
            god: () => { player.invuln = 9999; player.hurt = 0; damageFlash.v = 0; },
            clean: () => { player.hurt = 0; damageFlash.v = 0; floaters.length = 0; screenshake.v = 0; },
            endDay: () => { state.intro = 0; state.dayTimer = 0.05; },
            hurt: (n) => { player.invuln = 0; player.armor = 0; damagePlayer(n || 50, player.x, player.y); },
            phase: () => state.phase,
            give: (type, n) => { applyLoot(type, n || 1, player.x, player.y - 20, '#fff'); },
            loadout: () => captureLoadout(),
            stateInfo: () => ({ phase: state.phase, paused: state.paused, waveTimer: state.waveTimer, nightFade: state.nightFade, zombies: zombies.length, active: state.active, dayTimer: state.dayTimer }),
            stats: () => ({ kills: state.kills, opened: state.opened, total: state.lootTotal, phase: state.phase, hp: player.hp }),
            setHp: (v) => { player.hp = clamp(v, 0, 100); },
            levelInfo: () => ({
                name: level.name, w: W, h: H, loot: containers.length,
                spawn: level.spawn, exit: level.exit,
                containers: containers.map((c) => ({ x: c.x, y: c.y, t: c.t, opened: c.opened }))
            }),
            player: () => ({ x: player.x, y: player.y, hp: player.hp, phase: state.phase }),
            screenOf: (x, y) => ({ x: (x - cam.x) * view.scale, y: (y - cam.y) * view.scale }),
            fps: () => fpsValue,
            aim: () => ({ angle: player.angle, pointerWorldX: pointer.worldX, pointerWorldY: pointer.worldY, camX: cam.x, camY: cam.y, scale: view.scale, bullets: bullets.length }),
            navReport: () => {
                const report = [];
                for (const c of containers) {
                    const d = navAt(c.x, c.y);
                    report.push({ x: c.x, y: c.y, dist: d });
                }
                return report;
            }
        };
    }

    function destroy() {
        destroyed = true;
        if (raf) { window.cancelAnimationFrame(raf); raf = 0; }
        unbindInput();
        if (ui) {
            if (ui.action) { ui.action.removeEventListener('click', onAction); }
            if (ui.action2) { ui.action2.removeEventListener('click', onAction2); }
            if (ui.sound) { ui.sound.removeEventListener('click', onSound); }
            if (ui.pause) { ui.pause.removeEventListener('click', onPause); }
        }
        if (observer) { observer.disconnect(); observer = null; }
        else { window.removeEventListener('resize', onResize); }
        if (audio.ctx) {
            try { audio.ctx.close(); } catch (e) { /* 忽略 */ }
            audio.ctx = null;
            audio.master = null;
            audio.noise = null;
            audio.drone = null;
            audio.droneGain = null;
            audio.wind = null;
            audio.windGain = null;
        }
        if (canvas && canvas.parentNode) { canvas.parentNode.removeChild(canvas); }
        if (worldCanvas) { worldCanvas.width = 1; worldCanvas.height = 1; }
        if (lightCanvas) { lightCanvas.width = 1; lightCanvas.height = 1; }
        if (minimapBase) { minimapBase.width = 1; minimapBase.height = 1; }
        worldCanvas = null;
        worldCtx = null;
        lightCanvas = null;
        lightCtx = null;
        minimapBase = null;
        canvas = null;
        ctx = null;
        ui = null;
        root = null;
        stage = null;
        zombies = [];
        containers = [];
        solids = [];
        circleSolids = [];
        props = [];
        buildings = [];
        walls = [];
        fences = [];
        structures = [];
        lights = [];
        fires = [];
        pickups = [];
        bullets = [];
        particles = [];
        tracers = [];
        floaters = [];
        corpses = [];
        bloodStamps = [];
        if (window.__wastelandDebug) { delete window.__wastelandDebug; }
        if (window.__wastelandDestroy) { window.__wastelandDestroy = null; }
    }

    // ============================================================ 页面入口
    if (typeof window.__wastelandDestroy === 'function') {
        try { window.__wastelandDestroy(); } catch (e) { /* 上一个实例已失效 */ }
    }
    window.__wastelandDestroy = null;

    if (window.__wastelandPjax) {
        document.removeEventListener('pjax:send', window.__wastelandPjax);
    }
    window.__wastelandPjax = function () {
        if (typeof window.__wastelandDestroy === 'function') {
            try { window.__wastelandDestroy(); } catch (e) { /* 忽略 */ }
        }
        window.__wastelandDestroy = null;
    };
    document.addEventListener('pjax:send', window.__wastelandPjax);

    const rootEl = document.getElementById('wasteland-root');
    if (rootEl) {
        const api = mount(rootEl);
        window.__wastelandDestroy = api.destroy;
    }
})();
