<template>
  <Swiper
    v-if="props.slideNum"
    class="RmrSwiper w-full h-full min-h-[100vh]"
    :class="[`effect-${props.effect}`]"
    :direction="props.direction"
    :slides-per-view="1"
    :space-between="0"
    :resistanceRatio="0"
    :preventInteractionOnTransition="true"
    :speed="props.speed"
    :mousewheel="props.mousewheel ? { sensitivity: 1, releaseOnEdges: true } : false"
    :keyboard="props.keyboard ? { enabled: true, onlyInViewport: true } : false"
    :effect="
      props.effect === 'slide' ? 'slide' : props.effect === 'fade' ? 'fade' : undefined
    "
    :parallax="props.effect === 'parallax'"
    :modules="getModules()"
    :pagination="getPaginationConfig()"
    @swiper="onSwiperInit"
    @slide-change="onSwiperSlideChange"
    @transition-end="onSwiperTransitionEnd"
  >
    <!-- 普通全屏 slide -->
    <SwiperSlide
      v-for="(i, idx) in props.slideNum"
      :key="idx"
      :is-active="idx === currentSwiperIndex"
    >
      <div
        class="RmrSwiper-slide-wrapper"
        :data-swiper-parallax="props.effect === 'parallax' ? '-200' : undefined"
      >
        <slot
          :name="`SlideBody${idx + 1}`"
          :class="{
            'RmrSwiper-slide': true,
            'parallax-content': props.effect === 'parallax'
          }"
          :data-swiper-parallax="props.effect === 'parallax' ? -300 : undefined"
          :full-page="props.fullPage"
          :is-active="idx === currentSwiperIndex"
        />
      </div>
    </SwiperSlide>

    <!-- Footer slide：高度自适应，非全屏 -->
    <SwiperSlide v-if="props.hasFooter" class="RmrSwiper-slide-footer">
      <slot name="Footer" />
    </SwiperSlide>
  </Swiper>
</template>

<script setup lang="ts">
/**
 * 基于 Swiper 12，支持垂直/水平全屏滚动、视差效果、响应式设计
 */
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { Swiper, SwiperSlide } from 'swiper/vue'
import type { Swiper as SwiperInstance } from 'swiper'
import { Mousewheel, Pagination, Parallax, EffectFade } from 'swiper/modules'

// import 'swiper/css'
// import 'swiper/css/pagination'
// import 'swiper/css/effect-fade'
// import 'swiper/css/parallax'

// ---- Types ----

interface PaginationConfig {
  clickable?: boolean
  type?: 'bullets' | 'fraction' | 'progressbar' | 'custom'
  dynamicBullets?: boolean
  hideOnClick?: boolean
  renderBullet?: (index: number, className: string) => string
  renderFraction?: (currentClass: string, totalClass: string) => string
  renderProgressbar?: (progressbarFillClass: string) => string
  renderCustom?: (swiper: any, current: number, total: number) => string
}
interface Props {
  slideNum?: number
  hasFooter?: boolean
  direction?: 'horizontal' | 'vertical'
  effect?: 'fade' | 'parallax' | 'slide'
  speed?: number
  mousewheel?: boolean
  keyboard?: boolean
  fullPage?: boolean
  pagination?: boolean | PaginationConfig
}

// ---- Props ----
const props = withDefaults(defineProps<Props>(), {
  slideNum: 4,
  hasFooter: true,
  direction: 'vertical',
  effect: 'slide',
  speed: 700,
  mousewheel: true,
  keyboard: true,
  fullPage: true,
  pagination: false
})
const Emits = defineEmits<{
  slideChange: [swiper: SwiperInstance]
  transitionEnd: [swiper: SwiperInstance]
}>()

// ---- State ----
const swiperRef = ref<SwiperInstance | null>(null)
const currentSwiperIndex = computed(() => {
  return swiperRef.value?.activeIndex ?? 0
})
const isSliding = ref(false) // 防抖标志，防止连续触发 slidePrev
const dragStartY = ref<number | null>(null)
const dragPointerId = ref<number | null>(null)
let detachDragListeners: (() => void) | null = null

// ---- Swiper 模块 & 配置 ----
const getModules = () => {
  const modules = [Mousewheel, Pagination]
  if (props.effect === 'parallax') modules.push(Parallax)
  if (props.effect === 'fade') modules.push(EffectFade)
  return modules
}

const getPaginationConfig = () => {
  if (props.pagination === false) return false
  if (props.pagination === true) return {}
  return props.pagination
}

// ---- 核心逻辑 ----

/**
 * 修正 Footer slide 的渲染高度
 * 将 Footer slide 的高度设为实际内容高度，并修正 Swiper 的 translate
 */
const updateFooterSlideHeight = async () => {
  await nextTick()
  if (!swiperRef.value) return

  const swiper = swiperRef.value
  const totalSlides = swiper.slides.length
  const lastSlide = swiper.slides[totalSlides - 1]

  if (!lastSlide?.classList.contains('RmrSwiper-slide-footer')) return

  const footerContent = lastSlide.firstElementChild as HTMLElement
  if (!footerContent) return

  const actualHeight = footerContent.offsetHeight

  // 将 Footer slide 高度设为实际内容高度
  lastSlide.style.height = `${actualHeight}px`
  lastSlide.style.minHeight = `${actualHeight}px`

  await nextTick()
  swiper.update()
  fixSwiperSnapGrid(swiper)

  // 如果当前正在最后一屏，修正 translate 到正确位置
  if (swiper.activeIndex === totalSlides - 1) {
    const correctTranslate = -swiper.snapGrid[totalSlides - 1]
    swiper.setTranslate(correctTranslate)
  }
}

/**
 * 修正 Swiper 内部 snapGrid 和 slidesGrid
 *
 * 问题根因：setTranslate 修改了实际渲染位置，但 snapGrid/slidesGrid 没有同步，
 * 导致 slidePrev() 用 snapGrid 反查当前位置时找不到匹配项，fallback 到 index 0。
 *
 * 解决：在调用 slidePrev() 之前，重建正确的 snapGrid 和 slidesGrid。
 * - 前 N-1 个 slide：每个占 viewportHeight
 * - 最后一个 Footer slide：占实际内容高度
 */
const fixSwiperSnapGrid = (swiper: SwiperInstance) => {
  if (typeof window === 'undefined') return

  const totalSlides = swiper.slides.length
  const viewportHeight = swiper.height || window.innerHeight
  const lastSlide = swiper.slides[totalSlides - 1] as HTMLElement
  const footerHeight =
    (lastSlide?.firstElementChild as HTMLElement)?.offsetHeight ?? viewportHeight

  const correctSnapGrid: number[] = []
  const correctSlidesGrid: number[] = []

  for (let i = 0; i < totalSlides - 1; i++) {
    correctSnapGrid.push(i * viewportHeight)
    correctSlidesGrid.push(i * viewportHeight)
  }

  // Footer slide 的 snap 点 = 总高度 - viewportHeight（即滚动到底时的位置）
  const footerSnapPos =
    (totalSlides - 1) * viewportHeight - (viewportHeight - footerHeight)
  correctSnapGrid.push(footerSnapPos)
  correctSlidesGrid.push((totalSlides - 1) * viewportHeight)

  swiper.snapGrid = correctSnapGrid
  swiper.slidesGrid = correctSlidesGrid
}

// ---- 事件处理 ----

const slidePrevFromFooter = (swiper: SwiperInstance) => {
  if (isSliding.value) return
  isSliding.value = true
  fixSwiperSnapGrid(swiper)
  swiper.slidePrev(props.speed)
  setTimeout(() => {
    isSliding.value = false
  }, props.speed + 100)
}

const attachDragListenersToSwiper = (swiper: SwiperInstance) => {
  if (typeof window === 'undefined') return

  const el = swiper.el as HTMLElement | undefined
  if (!el) return

  if (detachDragListeners) detachDragListeners()

  const threshold = 30

  const isLastSlide = () =>
    props.direction === 'vertical' && swiper.activeIndex === swiper.slides.length - 1

  const onPointerDown = (e: PointerEvent) => {
    if (!isLastSlide()) return
    dragStartY.value = e.clientY
    dragPointerId.value = e.pointerId
    try {
      el.setPointerCapture(e.pointerId)
    } catch (_) {}
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!isLastSlide()) return
    if (dragStartY.value === null || dragPointerId.value !== e.pointerId) return
    const deltaY = e.clientY - dragStartY.value
    if (deltaY < -threshold) e.preventDefault()
  }

  const onPointerUpOrCancel = (e: PointerEvent) => {
    const startY = dragStartY.value
    const pointerId = dragPointerId.value
    dragStartY.value = null
    dragPointerId.value = null
    if (!isLastSlide()) return
    if (startY === null || pointerId !== e.pointerId) return
    const deltaY = e.clientY - startY
    if (deltaY > threshold) slidePrevFromFooter(swiper)
    else if (deltaY < -threshold) e.preventDefault()
  }

  if ('PointerEvent' in window) {
    el.addEventListener('pointerdown', onPointerDown, { passive: true })
    el.addEventListener('pointermove', onPointerMove, { passive: false })
    el.addEventListener('pointerup', onPointerUpOrCancel, { passive: false })
    el.addEventListener('pointercancel', onPointerUpOrCancel, { passive: false })

    detachDragListeners = () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUpOrCancel)
      el.removeEventListener('pointercancel', onPointerUpOrCancel)
      detachDragListeners = null
    }
    return
  }

  const onTouchStart = (e: TouchEvent) => {
    if (!isLastSlide()) return
    const touch = e.touches?.[0]
    if (!touch) return
    dragStartY.value = touch.clientY
  }

  const onTouchMove = (e: TouchEvent) => {
    if (!isLastSlide()) return
    if (dragStartY.value === null) return
    const touch = e.touches?.[0]
    if (!touch) return
    const deltaY = touch.clientY - dragStartY.value
    if (deltaY < -threshold) e.preventDefault()
  }

  const onTouchEndOrCancel = (e: TouchEvent) => {
    const startY = dragStartY.value
    dragStartY.value = null
    if (!isLastSlide()) return
    if (startY === null) return
    const touch = e.changedTouches?.[0]
    if (!touch) return
    const deltaY = touch.clientY - startY
    if (deltaY > threshold) slidePrevFromFooter(swiper)
    else if (deltaY < -threshold) e.preventDefault()
  }

  el.addEventListener('touchstart', onTouchStart, { passive: true })
  el.addEventListener('touchmove', onTouchMove, { passive: false })
  el.addEventListener('touchend', onTouchEndOrCancel, { passive: false })
  el.addEventListener('touchcancel', onTouchEndOrCancel, { passive: false })

  detachDragListeners = () => {
    el.removeEventListener('touchstart', onTouchStart)
    el.removeEventListener('touchmove', onTouchMove)
    el.removeEventListener('touchend', onTouchEndOrCancel)
    el.removeEventListener('touchcancel', onTouchEndOrCancel)
    detachDragListeners = null
  }
}

const onSwiperInit = (swiper: SwiperInstance) => {
  swiperRef.value = swiper
  updateFooterSlideHeight()
  attachDragListenersToSwiper(swiper)
  swiper.on('slideChangeTransitionEnd', () => {
    updateFooterSlideHeight()
  })
}

const onSwiperSlideChange = (swiper: SwiperInstance) => {
  // 每次切换后重新修正 Footer 高度（防止内容动态变化）
  updateFooterSlideHeight()

  // 到达最后一屏时禁用 Swiper 的 mousewheel，交给 handleMouseWheel 统一接管
  const isLastSlide = swiper.activeIndex === swiper.slides.length - 1

  const isAndroid = /(android)/i.test(navigator.userAgent)
  const isIOS = /(iphone|ipad|ipod|ios)/i.test(navigator.userAgent)

  if (isLastSlide) {
    swiper.mousewheel?.enabled && swiper.mousewheel.disable()
    swiper.allowTouchMove = false
  } else {
    !swiper.mousewheel?.enabled && swiper.mousewheel?.enable()
    swiper.allowTouchMove = isAndroid || isIOS ? true : false
  }

  Emits('slideChange', swiper)
}

function onSwiperTransitionEnd(swiper: SwiperInstance) {
  Emits('transitionEnd', swiper)
}

/**
 * 全局滚轮事件处理（只处理最后一屏）
 *
 * 在最后一屏时 Swiper 的 mousewheel 已被禁用，由此函数接管：
 * - 向上滚动：修正 snapGrid → slidePrev() → 防抖
 * - 向下滚动：preventDefault 阻止浏览器继续滚动
 */
const handleMouseWheel = (e: WheelEvent) => {
  if (!swiperRef.value || props.direction !== 'vertical') return

  const swiper = swiperRef.value
  const isLastSlide = swiper.activeIndex === swiper.slides.length - 1
  if (!isLastSlide) return

  if (e.deltaY < 0) {
    // 向上滚动：切换到上一屏
    if (!isSliding.value) {
      isSliding.value = true
      fixSwiperSnapGrid(swiper) // 先修正内部状态
      swiper.slidePrev(props.speed) // 再切换，位置正确
      setTimeout(() => {
        isSliding.value = false
      }, props.speed + 100)
    }
  } else {
    // 向下滚动：已是最后一屏，阻止继续滚动
    e.preventDefault()
  }
}

// ---- 常用方法 ----

function slideNext() {
  swiperRef.value?.slideNext()
}
function slidePrev() {
  swiperRef.value?.slidePrev()
}
function slideTo(index: number) {
  swiperRef.value?.slideTo(index)
}
function getSwiper() {
  return swiperRef.value
}

defineExpose({
  activeIndex: currentSwiperIndex,
  slideNext,
  slidePrev,
  slideTo,
  getSwiper
})

// ---- 生命周期 ----

onMounted(() => {
  if (typeof window === 'undefined') return
  document.addEventListener('wheel', handleMouseWheel, { passive: false })
  window.addEventListener('resize', updateFooterSlideHeight)
})

onUnmounted(() => {
  if (typeof window === 'undefined') return
  document.removeEventListener('wheel', handleMouseWheel)
  window.removeEventListener('resize', updateFooterSlideHeight)
  if (detachDragListeners) detachDragListeners()
})
</script>

<style scoped>
.RmrSwiper {
  overflow: hidden;
}
.RmrSwiper-slide {
  display: flex;
  align-items: center;
  justify-content: center;
}
.RmrSwiper-slide-wrapper {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.RmrSwiper-slide-wrapper .parallax-content {
  transition: transform 0.3s ease;
}
/* Footer slide 高度由内容决定，不强制全屏 */
.RmrSwiper-slide-footer {
  align-items: flex-start !important;
  width: 100%;
  height: auto !important;
  min-height: auto !important;
}
.RmrSwiper-slide-footer[style*='height'] {
  height: auto !important;
  min-height: auto !important;
}
</style>
