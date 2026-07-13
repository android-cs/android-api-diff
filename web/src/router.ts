import { createWebHistory, createRouter } from 'vue-router';

const homeFc = () => import('./views/home/HomePage.vue');
const mcpFc = () => import('./views/mcp/MCPPage.vue');
export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: homeFc,
      beforeEnter: (to) => {
        if (to.query.ref) {
          return `/i/${to.query.ref}`;
        }
      },
    },
    {
      // /i/IActivityTaskManager#getTasks
      path: '/i/:pathMatch(.*)*',
      component: homeFc,
    },
    {
      path: '/mcp',
      component: mcpFc,
    },
    {
      path: '/:pathMatch(.*)*',
      component: () => import('./views/404Page.vue'),
    },
  ],
});
