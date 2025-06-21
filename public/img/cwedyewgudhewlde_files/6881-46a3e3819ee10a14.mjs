"use strict";(self.modernJsonp=self.modernJsonp||[]).push([[6881],{25690:(e,t,n)=>{n.d(t,{default:()=>r});var a=n(718222);let i=`pulsing {
  0% {
    opacity: 1;
  }

  50% {
    opacity: 0.4;
  }

  100% {
    opacity: 1;
  }
}`,r={css:(0,a.Ll)([i]),animation:"pulsing 2s infinite"}},718222:(e,t,n)=>{n.d(t,{CC:()=>i,Ll:()=>o,XF:()=>r});let a=(e,t,n)=>({x:Math.floor(e*Math.cos(n)),y:Math.floor(t*Math.sin(n))}),i=(e,t)=>a(t/2,e/2,2*Math.random()*Math.PI),r=(e,t)=>Math.floor(Math.random()*(t-e+1))+e,o=e=>["@-webkit-keyframes","@keyframes"].map(t=>e.map(e=>t+" "+e).join(`
`)).join(`
`)},633569:(e,t,n)=>{n.r(t),n.d(t,{default:()=>R});var a=n(667294),i=n(883119),r=n(569681),o=n(19963),l=n(756064);function s(e,t,n){var a;return(t="symbol"==typeof(a=function(e,t){if("object"!=typeof e||!e)return e;var n=e[Symbol.toPrimitive];if(void 0!==n){var a=n.call(e,t||"default");if("object"!=typeof a)return a;throw TypeError("@@toPrimitive must return a primitive value.")}return("string"===t?String:Number)(e)}(t,"string"))?a:a+"")in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}let u={},m=e=>{let t=e.__id||e.id;return"string"==typeof t&&t||null};class p{constructor(){s(this,"idMap",new Map),s(this,"objMap",new WeakMap)}get(e){let t=m(e);return this.objMap.get(e)??(t?this.idMap.get(t):void 0)}has(e){let t=m(e);return this.objMap.has(e)??(!!t&&this.idMap.has(t))}set(e,t){let n=m(e);n&&this.idMap.set(n,t),this.objMap.set(e,t)}reset(){this.idMap=new Map,this.objMap=new WeakMap}}function d(e,t){return"number"==typeof e?e:"_lg1"===t?e[t]??e.lg??1:e[t]??1}var c=n(399083),h=n(824834),g=n(830811),f=n(25690),y=n(970601),x=n(785893);let{css:b,animation:_}=f.default,v={backgroundColor:g._VP,animation:_,borderRadius:g.Ev2};function w({data:e}){let{height:t}=e;return(0,x.jsxs)(a.Fragment,{children:[(0,x.jsx)(y.Z,{unsafeCSS:b}),(0,x.jsx)(i.xu,{dangerouslySetInlineStyle:{__style:v},"data-test-id":"skeleton-pin",children:(0,x.jsx)(i.xu,{height:t})})]})}var M=n(56063),C=n(967312),k=n(174646),$=n(538645),j=n(992114),S=n(438596);function R(e){let{align:t,cacheKey:n,id:s,isFetching:m,isGridCentered:g=!0,items:f,layout:b,loadItems:_,masonryRef:v,optOutFluidGridExperiment:R=!1,renderItem:W,scrollContainerRef:A,virtualize:I=!0,_getColumnSpanConfig:F,_getResponsiveModuleConfigForSecondItem:G,_dynamicHeights:E,isLoadingStateEnabled:P,initialLoadingStatePinCount:O,isLoadingAccessibilityLabel:H,isLoadedAccessibilityLabel:N}=e,X=(0,$.ZP)(),{isAuthenticated:Z,isRTL:T}=(0,k.B)(),{logContextEvent:B}=(0,o.v)(),Q=(0,C.F)(),z="desktop"===X,J=(0,S.MM)(),V=((0,a.useRef)(f.map(()=>({fetchTimestamp:Date.now(),measureTimestamp:Date.now(),hasRendered:!1,pageCount:0}))),z&&!R),{experimentalColumnWidth:q,experimentalGutter:D}=(0,c.Z)(V),L=e.serverRender??!!z,K="flexible"===b||"uniformRowFlexible"===b||"desktop"!==X||V,U=(K&&b?.startsWith("uniformRow")?"uniformRowFlexible":void 0)??(L?"serverRenderedFlexible":"flexible"),Y=e.columnWidth??q??M.yF;K&&(Y=Math.floor(Y));let ee=e.gutterWidth??D??(z?M.oX:1),et=e.minCols??M.yc,en=(0,a.useRef)(0),ea=Y+ee,ei=function(e){if(null==e)return;let t=function(e){let t=u[e];return t&&t.screenWidth===window.innerWidth||(u[e]={screenWidth:window.innerWidth}),u[e]}(e);return t.measurementCache||(t.measurementCache=new p),t.measurementCache}(n),er=(0,a.useCallback)(()=>A?.current||window,[A]),eo=(0,a.useRef)(!0),{anyEnabled:el,group:es}=Q.checkExperiment("web_masonry_enable_dynamic_heights_for_all"),{anyEnabled:eu}=Q.checkExperiment("web_masonry_pin_overlap_calculation_and_logging"),em=g&&eo.current?"centered":"",{className:ep,styles:ed}=function(e){let t=`m_${Object.keys(e).sort().reduce((t,n)=>{let a=e[n];return null==a||"object"==typeof a||"function"==typeof a?t:"boolean"==typeof a?t+(a?"t":"f"):t+a},"").replace(/\:/g,"\\:")}`,{flexible:n,gutterWidth:a,isRTL:i,itemWidth:r,maxColumns:o,minColumns:l,items:s,_getColumnSpanConfig:u,_getResponsiveModuleConfigForSecondItem:m}=e,p=u?s.map((e,t)=>({index:t,columnSpanConfig:u(e)??1})).filter(e=>1!==e.columnSpanConfig):[],c=r+a,h=Array.from({length:o+1-l},(e,t)=>t+l).map(e=>{let h,g,f=e===l?0:e*c,y=e===o?null:(e+1)*c-.01;u&&m&&s.length>1&&(h=u(s[0]),g=m(s[1]));let{styles:x,numberOfVisibleItems:b}=p.reduce((i,o)=>{let{columnSpanConfig:l}=o,u=Math.min(function({columnCount:e,columnSpanConfig:t,firstItemColumnSpanConfig:n,isFlexibleWidthItem:a,secondItemResponsiveModuleConfig:i}){let r=e<=2?"sm":e<=4?"md":e<=6?"_lg1":e<=8?"lg":"xl",o=d(t,r);if(a){let t=d(n,r);o="number"==typeof i?i:i?Math.max(i.min,Math.min(i.max,e-t)):1}return o}({columnCount:e,columnSpanConfig:l,isFlexibleWidthItem:!!g&&o===s[1],firstItemColumnSpanConfig:h??1,secondItemResponsiveModuleConfig:g??1}),e),m=null!=o.index&&i.numberOfVisibleItems>=u+o.index,p=n?100/e*u:r*u+a*(u-1),{numberOfVisibleItems:c}=i;return m?c-=u-1:o.index<c&&(c+=1),{styles:i.styles.concat(function({className:e,index:t,columnSpanConfig:n,visible:a,width:i,flexible:r}){let o="number"==typeof n?n:btoa(JSON.stringify(n));return r?`
      .${e} .static[data-column-span="${o}"]:nth-child(${t+1}) {
        visibility: ${a?"visible":"hidden"} !important;
        position: ${a?"inherit":"absolute"} !important;
        width: ${i}% !important;
      }`:`
      .${e} .static[data-column-span="${o}"]:nth-child(${t+1}) {
        visibility: ${a?"visible":"hidden"} !important;
        position: ${a?"inherit":"absolute"} !important;
        width: ${i}px !important;
      }`}({className:t,index:o.index,columnSpanConfig:l,visible:m,width:p,flexible:n})),numberOfVisibleItems:c}},{styles:"",numberOfVisibleItems:e}),_=n?`
      .${t} .static {
        box-sizing: border-box;
        width: calc(100% / ${e}) !important;
      }
    `:`
      .${t} {
        max-width: ${e*c}px;
      }

      .${t} .static {
        width: ${r}px !important;
      }
    `;return{minWidth:f,maxWidth:y,styles:`
      .${t} .static:nth-child(-n+${b}) {
        position: static !important;
        visibility: visible !important;
        float: ${i?"right":"left"};
        display: block;
      }

      .${t} .static {
        padding: 0 ${a/2}px;
      }

      ${_}

      ${x}
    `}}),g=h.map(({minWidth:e,maxWidth:t,styles:n})=>`
    @container (min-width: ${e}px) ${t?`and (max-width: ${t}px)`:""} {
      ${n}
    }
  `),f=h.map(({minWidth:e,maxWidth:t,styles:n})=>`
    @media (min-width: ${e}px) ${t?`and (max-width: ${t}px)`:""} {
      ${n}
    }
  `),y=`
    ${g.join("")}
    @supports not (container-type: inline-size) {
      ${f.join("")}
    }
  `;return{className:t,styles:`
    .masonryContainer:has(.${t}) {
      container-type: inline-size;
    }

    .masonryContainer > .centered {
      margin-left: auto;
      margin-right: auto;
    }

    .${t} .static {
      position: absolute !important;
      visibility: hidden !important;
    }

    ${y}
  `}}({gutterWidth:ee,flexible:K,items:f,isRTL:T,itemWidth:Y,maxColumns:e.maxColumns??Math.max(f.length,M.g5),minColumns:et,_getColumnSpanConfig:F,_getResponsiveModuleConfigForSecondItem:G}),ec=`${em} ${ep}`.trim(),{anyEnabled:eh,expName:eg,group:ef,isMeasureAllEnabled:ey}=(0,h.Z)(),ex=((0,a.useRef)(void 0),(0,a.useRef)(f.length)),eb=(0,a.useRef)(0),e_=(0,a.useRef)(null);(0,a.useEffect)(()=>{ex.current=f.length,eb.current+=1},[f]),(0,a.useEffect)(()=>{eo.current&&(eo.current=!1)},[]),(0,a.useEffect)(()=>()=>{},[]);let ev=(0,a.useCallback)(e=>{let t=e.reduce((e,t)=>e+t),n=t/e.length;(0,j.S0)("webapp.masonry.multiColumnWhitespace.average",n,{sampleRate:1,tags:{experimentalMasonryGroup:ef||"unknown",handlerId:J,isAuthenticated:Z,multiColumnItemSpan:e.length}}),(0,j.S0)("webapp.masonry.twoColWhitespace",n,{sampleRate:1,tags:{columnWidth:Y,minCols:et}}),B({event_type:15878,component:14468,aux_data:{total_whitespace_px:t}}),B({event_type:16062,component:14468,aux_data:{average_whitespace_px:n}}),B({event_type:16063,component:14468,aux_data:{max_whitespace_px:Math.max(...e)}}),e.forEach(t=>{t>=50&&((0,j.nP)("webapp.masonry.multiColumnWhitespace.over50",{sampleRate:1,tags:{experimentalMasonryGroup:ef||"unknown",handlerId:J,isAuthenticated:Z,multiColumnItemSpan:e.length}}),B({event_type:16261,component:14468})),t>=100&&((0,j.nP)("webapp.masonry.multiColumnWhitespace.over100",{sampleRate:1,tags:{experimentalMasonryGroup:ef||"unknown",handlerId:J,isAuthenticated:Z,multiColumnItemSpan:e.length}}),B({event_type:16262,component:14468}))}),(0,j.nP)("webapp.masonry.multiColumnWhitespace.count",{sampleRate:1,tags:{experimentalMasonryGroup:ef||"unknown",handlerId:J,isAuthenticated:Z,multiColumnItemSpan:e.length}})},[Y,B,et,Z,J,ef]),{_items:ew,_renderItem:eM}=function({initialLoadingStatePinCount:e=50,infiniteScrollPinCount:t=10,isFetching:n,items:i=[],renderItem:r,isLoadingStateEnabled:o}){let l=+(i.filter(e=>"object"==typeof e&&null!==e&&"type"in e&&"closeup_module"===e.type).length>0),s=o&&n,u=(0,a.useMemo)(()=>Array.from({length:i.length>l?t:e}).reduce((e,t,n)=>[...e,{height:n%2==0?356:236,key:`skeleton-pin-${n}`,isSkeleton:!0}],[]),[i.length,l,t,e]);return{_items:(0,a.useMemo)(()=>s?[...i,...u]:i,[s,i,u]),_renderItem:(0,a.useMemo)(()=>o?e=>{let{itemIdx:t,data:n}=e;return t>=i.length&&n&&"object"==typeof n&&"key"in n&&"height"in n?(0,x.jsx)(w,{data:n},n.key):r(e)}:r,[o,r,i.length])}}({isLoadingStateEnabled:P,items:f,renderItem:(0,a.useCallback)(e=>(0,x.jsx)(l.Z,{name:"MasonryItem",children:W(e)}),[W]),isFetching:m,initialLoadingStatePinCount:O}),eC=P&&m,ek=(0,a.useRef)(new Set);(0,a.useEffect)(()=>{if(!eu)return;let e=setTimeout(()=>{requestAnimationFrame(()=>{let e=Array.from(e_.current?.querySelectorAll("[data-grid-item-idx]")??[]);if(0===e.length)return;let t=e.map(e=>{let t=e.getAttribute("data-grid-item-idx");return{rect:e.getBoundingClientRect(),itemIdx:t}}),n=0,a=0,i=0,r=0,o=0,l=0;for(let e=0;e<t.length;e+=1){let s=t[e]?.rect,u=t[e]?.itemIdx;for(let m=e+1;m<t.length;m+=1){let e=t[m]?.rect,p=t[m]?.itemIdx;if(s&&e&&u&&p){let t=[u,p].sort().join("|");if(!ek.current.has(t)&&s.right>=e.left&&s.left<=e.right&&s.bottom>=e.top&&s.top<=e.bottom&&s.height>0&&e.height>0){ek.current.add(t),n+=1;let u=Math.max(0,Math.min(s.right,e.right)-Math.max(s.left,e.left))*Math.max(0,Math.min(s.bottom,e.bottom)-Math.max(s.top,e.top));u>8e4?l+=1:u>4e4?o+=1:u>1e4?r+=1:u>5e3?i+=1:u>2500&&(a+=1)}}}}n>0&&(0,j.QX)("webapp.masonry.pinOverlapHits",n,{tags:{isAuthenticated:Z,isDesktop:z,handlerId:J,experimentalMasonryGroup:ef||"unknown",dynamicHeightsForAllGroup:es||"unknown"}}),a>0&&(0,j.QX)("webapp.masonry.pinOverlap.AreaPx.over2500",a,{tags:{isAuthenticated:Z,isDesktop:z,handlerId:J,experimentalMasonryGroup:ef||"unknown",dynamicHeightsForAllGroup:es||"unknown"}}),i>0&&(0,j.QX)("webapp.masonry.pinOverlap.AreaPx.over5000",i,{tags:{isAuthenticated:Z,isDesktop:z,handlerId:J,experimentalMasonryGroup:ef||"unknown",dynamicHeightsForAllGroup:es||"unknown"}}),r>0&&(0,j.QX)("webapp.masonry.pinOverlap.AreaPx.over10000",r,{tags:{isAuthenticated:Z,isDesktop:z,handlerId:J,experimentalMasonryGroup:ef||"unknown",dynamicHeightsForAllGroup:es||"unknown"}}),o>0&&(0,j.QX)("webapp.masonry.pinOverlap.AreaPx.over40000",o,{tags:{isAuthenticated:Z,isDesktop:z,handlerId:J,experimentalMasonryGroup:ef||"unknown",dynamicHeightsForAllGroup:es||"unknown"}}),l>0&&(0,j.QX)("webapp.masonry.pinOverlap.AreaPx.over80000",l,{tags:{isAuthenticated:Z,isDesktop:z,handlerId:J,experimentalMasonryGroup:ef||"unknown",dynamicHeightsForAllGroup:es||"unknown"}})})},1e3);return()=>{clearTimeout(e)}},[Y,ef,Z,z,eu,f,J,es]);let e$=(0,r.Z)(),ej=(0,a.useCallback)(e=>{v&&(v.current=e)},[v]);return(0,x.jsxs)(a.Fragment,{children:[P&&!eo.current&&(0,x.jsx)(i.xu,{"aria-live":"polite",display:"visuallyHidden",children:eC?H:N}),(0,x.jsx)("div",{ref:e_,"aria-busy":P?!!eC:void 0,className:"masonryContainer","data-test-id":"masonry-container",id:s,style:V?{padding:`0 ${ee/2}px`}:void 0,children:(0,x.jsxs)("div",{className:ec,children:[L&&eo.current?(0,x.jsx)(y.Z,{"data-test-id":"masonry-ssr-styles",unsafeCSS:ed}):null,(0,x.jsx)(i.xu,{"data-test-id":"max-width-container",marginBottom:0,marginEnd:"auto",marginStart:"auto",marginTop:0,maxWidth:e.maxColumns?ea*e.maxColumns:void 0,children:eh?(0,x.jsx)(i.GX,{ref:e$?ej:e=>{v&&(v.current=e)},_dynamicHeights:el||E,_getColumnSpanConfig:F,_getResponsiveModuleConfigForSecondItem:G,_logTwoColWhitespace:ev,_measureAll:ey,align:t,columnWidth:Y,gutterWidth:ee,items:ew,layout:K?U:b??"basic",loadItems:_,measurementStore:ei,minCols:et,renderItem:eM,scrollContainer:er,virtualBufferFactor:.3,virtualize:I}):(0,x.jsx)(i.Rk,{ref:e$?ej:e=>{v&&(v.current=e)},_dynamicHeights:el||E,_getColumnSpanConfig:F,_getResponsiveModuleConfigForSecondItem:G,_logTwoColWhitespace:ev,align:t,columnWidth:Y,gutterWidth:ee,items:ew,layout:K?U:b??"basic",loadItems:_,measurementStore:ei,minCols:et,renderItem:eM,scrollContainer:er,virtualBufferFactor:.3,virtualize:I})})]})})]})}},399083:(e,t,n)=>{n.d(t,{Z:()=>a});function a(e=!0){let t=e?16:void 0,n=t?Math.floor(t/4):void 0;return{experimentalColumnWidth:e?221:void 0,experimentalGutter:t,experimentalGutterBoints:n}}},824834:(e,t,n)=>{n.d(t,{Z:()=>o});var a=n(967312),i=n(174646),r=n(438596);function o(e){let{isAuthenticated:t}=(0,i.B)(),{expName:n,anyEnabled:o,group:l}=function({experimentsClient:e,handlerId:t,isAuthenticated:n,skipActivation:a}){let{checkExperiment:i}=e,r=i(n?"web_masonry_v2_auth":"web_masonry_v2_unauth",{dangerouslySkipActivation:a});return r.group?{expName:n?"web_masonry_v2_auth":"web_masonry_v2_unauth",...r}:"www/[username]/[slug].js"!==t||n?"www/pin/[id].js"!==t||n?{expName:"",anyEnabled:!1,group:""}:{expName:"web_masonry_v2_unauth_pin",...i("web_masonry_v2_unauth_pin",{dangerouslySkipActivation:a})}:{expName:"web_masonry_v2_unauth_board",...i("web_masonry_v2_unauth_board",{dangerouslySkipActivation:a})}}({experimentsClient:(0,a.F)(),handlerId:(0,r.MM)(),isAuthenticated:t,skipActivation:e?.skipActivation??!1});return{expName:n,anyEnabled:o,group:l,isMeasureAllEnabled:"enabled_measure_all"===l||"enabled_measure_all_impression_fix"===l,isImpressionFixEnabled:"control_impression_fix"===l||"enabled_impression_fix"===l||"enabled_measure_all_impression_fix"===l}}}}]);
//# sourceMappingURL=https://sm.pinimg.com/webapp/6881-46a3e3819ee10a14.mjs.map