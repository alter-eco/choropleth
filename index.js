var Choropleth;

module.exports = Choropleth = {
  create: function() {
    var instance = Object.assign({}, this.prototype);

    this.init.apply(instance, arguments);

    return instance;
  },

  init: function(config) {
    this.geojson = config.geojson;
    this.valueColumn = config.valueColumn;
    this.geoIdKey = config.geoIdKey;

    this.config = {};

    this.config.neutralColor = config.neutralColor;

    if (config.numericalValues === false) {
      this.config.numericalValues = config.numericalValues;
    }
    else {
      this.config.numericalValues = true;
    }

    this.config.legend = Object.assign({
      orientation: 'vertical',
    }, config.legend);

    this.config.scale = Object.assign({
      type: 'linear',
      minColor: 'blue',
      maxColor: 'red'
    }, config.scale);

    var margin = {
      top: 20,
      right: 10,
      bottom: 20,
      left: 10
    };

    var rawWidth = document.documentElement.clientWidth;
    var rawHeight = document.documentElement.clientHeight;

    this.width = rawWidth - margin.left - margin.right;
    this.height = rawHeight - margin.top - margin.bottom;

    this.map = d3.select(config.elem)
      .append('svg')
      .attr('width', this.width + margin.left + margin.right)
      .attr('height', this.height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    this.layer = this.map.append('g')
      .attr('id', 'layer');

    this.g = this.map.append('g')
      .attr('class', 'key');

    this.setData(config.data);


    this.map.call(d3.zoom()
      .on('zoom', function() {
        this.layer.attr('transform', d3.event.transform);
      }.bind(this))
    );

    if (config.tooltip && config.tooltip.enabled !== false) {
      this.config.tooltip = Object.assign({
        prefix: '',
        suffix: ''
      }, config.tooltip);

      this.tooltip = d3.select('body').append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0);
    }
  },

  prototype: {
    showTooltip: function(tooltipData) {
      this.tooltip.transition()
        .duration(200)
        .style('opacity', 1);

      var number = tooltipData[this.valueColumn];

      number = number.toLocaleString('fr');

      var markup = [
        '<div class="tooltip-title" style="background-color:' + this.scale(tooltipData[this.valueColumn]) + '">',
          tooltipData.name || tooltipData[this.geoIdKey],
        '</div>',
        '<div class="tooltip-item">',
          this.config.tooltip.prefix + number + this.config.tooltip.suffix,
        '</div>',
      ].join('\n');

      this.tooltip.html(markup)
        .style('left', (d3.event.pageX) + 'px')
        .style('top', (d3.event.pageY - 50) + 'px');
    },

    hideTooltip: function() {
      this.tooltip.transition()
        .duration(300)
        .style('opacity', 0);
    },

    fill: function(datum) {
      var geoKey = datum.properties[this.geoIdKey];

      if (this.dataById.hasOwnProperty(geoKey)) {
        return this.scale(this.dataById[geoKey][this.valueColumn]);
      }

      return this.config.neutralColor;
    },

    setData: function(data) {
      this.data = data;

      this.dataById = {};

      this.data.forEach(function(datum) {
        if (this.config.numericalValues) {
          datum[this.valueColumn] = parseInt(datum[this.valueColumn]);
        }

        this.dataById[datum[this.geoIdKey]] = datum;
      }.bind(this));

      this.setScale();
    },

    updateLegend: function() {
      var legend = d3.legendColor()
        .labelFormat(d3.format(this.config.legend.format))
        .shapeWidth(50)
        .orient(this.config.legend.orientation)
        .scale(this.scale);

      this.map.select('.key g')
        .remove();


      var legendSelection = this.map.select('.key');

      legendSelection.call(legend);

      legendSelection.attr('transform', 'translate(0,' + (this.height - legendSelection.node().getBBox().height) + ')')
    },

    setScale: function() {
      var scaleData = this.data.map(function(datum) {
        return datum[this.valueColumn];
      }.bind(this));

      if (this.config.scale.type === 'linear') {
        var min = d3.min(scaleData);
        var max = d3.max(scaleData);

        this.scale = d3.scaleLinear()
          .domain([min, max])
          .range([this.config.scale.minColor, this.config.scale.maxColor]);
      }
      else if (this.config.scale.type === 'ordinal') {
        var domain = {};

        scaleData.forEach(function(item) {
          domain[item];
        });

        domain = Object.keys(domain);

        this.scale = d3.scaleOrdinal()
          .domain(domain)
          .range(this.config.scale.colors)
      }

      setTimeout(function() {
        this.updateLegend();
      }.bind(this), 0)
    },

    draw: function() {
      var path = d3.geoPath()
        .projection(d3.geoMercator()
          .fitExtent([
            [20, 20],
            [this.width, this.height]
          ], this.geojson));

      this.layerSelect = this.layer
        .selectAll('path')
        .data(this.geojson.features);

      // enter
      this.layerSelect
        .enter()
        .append('path')
        .attr('d', path)
        .attr('class', 'region')
        .attr('id', function(d) {
          return d.properties.nom;
        })
        .attr('fill', this.fill.bind(this))
        .on('mouseover', function(d) {
          if (!this.tooltip) {
            return false;
          }

          var tooltipData = this.dataById[d.properties[this.geoIdKey]];

          if (!tooltipData || tooltipData[this.selected] === '') {
            return false;
          } else {
            this.showTooltip(tooltipData);
          }
        }.bind(this))
        .on('mouseout', function() {
          if (!this.tooltip) {
            return false;
          }

          this.hideTooltip();
        }.bind(this))

      this.updateLegend();
    }
  }
};
