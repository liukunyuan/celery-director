const COLORS = {
  'success': {
    'background': '#4caf50',
    'border': '#1d7521',
    'hlborder': '#237d27'
  },
  'error': {
    'background': '#f44336',
    'border': '#c7261a',
    'hlborder': '#b8170b'
  },
  'pending': {
    'background': '#787777',
    'border': '#555',
    'hlborder': '#635f5f'
  }
};

function getNode(task) {
  return {
    id: task.id,
    label: task.key,
    shape: 'box',
    borderWidth: 1,
    color: {
      border: COLORS[task.status]['border'],
      background: COLORS[task.status]['background'],
      highlight: {
        background: COLORS[task.status]['background'],
        border: COLORS[task.status]['hlborder'],
      }
    },
    font: {
      face: 'arial',
      align: 'center',
      color: '#fff',
      strokeWidth: 0,
      strokeColor: '#ffffff',
    }
  };
}

const store = new Vuex.Store({
	state: {
    workflows: [],
    network: null,
    selectedWorkflow: null,
    selectedTask: null,
    taskIndex: null,
    loading: true
  },
  actions: {
    listWorkflows({commit}) {
      axios.get(API_URL + "/workflows").then((response) => {
        commit('updateWorkflows', response.data)
        commit('changeLoadingState', false)
    	})
    },
    getWorkflow({commit}, workflow_id) {
      axios.get(API_URL + "/workflows/" + workflow_id).then((response) => {
        commit('updateSelectedWorkflow', response.data)
        commit('refreshNetwork', response.data.tasks)
        commit('changeLoadingState', false)
    	})
    },
    selectTask({commit}, task) {
      commit('updateSelectedTask', task)
    },
    relaunchWorkflow({commit, dispatch}, workflow_id) {
      axios.post(API_URL + "/workflows/" + workflow_id + "/relaunch").then((response) => {
        dispatch("listWorkflows")
        dispatch("getWorkflow", response.data.id)
      });
    }
  },
  mutations: {
    updateWorkflows(state, workflows) {
      state.workflows = workflows
    },
    updateSelectedWorkflow(state, workflow) {
      state.taskIndex = null
      state.selectedWorkflow = workflow
    },
    updateSelectedTask(state, task) {
      state.selectedTask = task
    },
    refreshNetwork(state, tasks) {
      var g = new dagreD3.graphlib.Graph().setGraph({});

      for (let i = 0; i < tasks.length; i++) {
        var className = tasks[i].status;
        var html = "<div class=pointer>";
            html += "<span class=status></span>";
            html += "<span class=name>"+tasks[i].key+"</span>";
            html += "<br>"
            html += "<span class=details>"+tasks[i].id+"</span>";
            html += "</div>";

        var color = COLORS[tasks[i].status]["background"];
        g.setNode(tasks[i].id, {
          labelType: "html",
          label: html,
          rx: 3,
          ry: 3,
          padding: 0,
          class: className
        });

        for (let j=0; j<tasks[i].previous.length; j++) {
          g.setEdge(tasks[i].previous[j], tasks[i].id, {});
        }
        
      }

      // Set some general styles
      g.nodes().forEach(function(v) {
        var node = g.node(v);
        node.rx = node.ry = 5;
      });


      var svg = d3.select("svg"),
          inner = svg.select("g");
      
      // Set up zoom support
      var zoom = d3.zoom().on("zoom", function() {
            inner.attr("transform", d3.event.transform);
          });
      inner.call(zoom.transform, d3.zoomIdentity);
      svg.call(zoom);

      // Create the renderer
      var render = new dagreD3.render();

      // Run the renderer. This is what draws the final graph.
      render(inner, g);

      // Center the graph
      var initialScale = 1.0;
      svg.call(zoom.transform, d3.zoomIdentity.translate((svg.attr("width") - g.graph().width * initialScale) / 2, 20).scale(initialScale));

      var nodes = inner.selectAll("g.node");
      nodes.on('click', function (task_id) {
        state.selectedTask = tasks.find(c => c.id == task_id);
      });
    },
    changeLoadingState(state, loading) {
    	state.loading = loading
    }
  }
});


Vue.filter('formatDate', function(value) {
  if (value) {
    return moment(String(value)).format('MMM DD, HH:mm:ss')
  }
});

Vue.filter('statusColor', function(status) {
  if ( status == 'success' ) {
    return '#4caf50';
  } else if ( status == 'error' ) {
    return '#f44336';
  } else {
    return '#787777';
  }
});

Vue.filter('countTasksByStatus', function(workflows, status) {
    const tasks = workflows.filter(c => c.status === status);
    return tasks.length;
});

new Vue({
    el: '#app',
    computed: Vuex.mapState(['workflows', 'selectedWorkflow', 'selectedTask', 'taskIndex', 'network', 'loading', 'headers']),
    store,
    vuetify: new Vuetify({
      theme: {
        dark: DARK_THEME,
      },
    }),
    data: () => ({
      drawer: null,
      tab: null,
      payloadDialog: false,
      taskDialog: false,
      relaunchDialog: false,
      search: '',
      headers: [
        { text: 'Name', align: 'left', value: 'fullname',},
        { text: 'Date', align: 'left', value: 'created' },
        { text: '', value: 'status', sortable: false },
      ],
    }),
    methods: {
      getColor: function (status) {
        var color = {
          'success': 'green',
          'error': 'red',
          'warning': 'orange'
        }[status];
        return color;
      },
      selectRow: function (item) {
        let prevItem = this.workflows.find(c => c.isSelected);
        if (prevItem) this.$delete(prevItem, 'isSelected');
        this.$set(item, "isSelected", true)
        this.$store.dispatch('getWorkflow', item.id)
      },
      displayTask: function(task) {
        this.$store.dispatch('selectTask', task);
        this.taskDialog = true;
      },
      relaunchWorkflow: function() {
        this.$store.dispatch('relaunchWorkflow', this.selectedWorkflow.id);
        this.relaunchDialog = false;
      },
      getFlowerTaskUrl: function() {
        return FLOWER_URL + "/task/" + this.selectedTask.id;
      }
    },
    created() {
      this.$store.dispatch('listWorkflows')
    }
  });
