# rmr‑swiper

[![NPM Downloads](https://img.shields.io/npm/dm/rmr-swiper.svg)](https://www.npmjs.com/package/rmr-swiper)

> combined swiper for official website, with vue3 support.

## install

```bash
npm i rmr-swiper swiper
```

## use

```
// -----normal case-----
import { RmrSwiper } from 'rmr-swiper'
import 'rmr-swiper/style.css'
import 'swiper/css'

// ---import if need
// import 'swiper/css/pagination'
// import 'swiper/css/navigation'
// import 'swiper/css/effect-fade'
// import 'swiper/css/parallax'

// -------Another-------
import RmrSwiper from 'rmr-swiper'
import 'rmr-swiper/style.css'
import 'swiper/css'

const app = createApp(App)
app.use(RmrSwiper)
```

## hint

> effect=fade下不支持存在Footer （可替代為隱藏式fixed Footer）
