<template>
  <RmrSwiper :slideNum="3" :hasFooter="true" class="rs" style="height: 100vh">
    <template #SlideBody1>
      <div style="height: 100%; background-color: skyblue; color: #fff">
        <div style="text-align: center">sect1</div>
      </div>
    </template>
    <template #SlideBody2>
      <div style="height: 100%; background-color: greenyellow; color: #fff">
        <div style="text-align: center">sect2</div>
      </div>
    </template>
    <template #SlideBody3>
      <div style="height: 100%; background-color: blueviolet; color: #fff">
        <div style="text-align: center">sect3</div>
      </div>
    </template>
    <template #Footer>
      <div style="height: 120px; background-color: firebrick; color: #fff">
        <div style="text-align: center">sect4</div>
      </div>
    </template>
  </RmrSwiper>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { RmrSwiper } from '../src'

//
</script>
