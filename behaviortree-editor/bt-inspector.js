Vue.component('foobar-inspector', {
  template: `
    <ui-button v-on:click="openBTEditor">编辑</ui-button>
  `,

  props: {
    target: {
      twoWay: true,
      type: Object,
    },
  },

  methods: {
    openBTEditor:function(){
        Editor.Ipc.sendToMain('behaviortree-editor:re-open-by-comp',{uuid:this.target.__scriptAsset.value.uuid,name:this.target.name.value});
    }
  }
});