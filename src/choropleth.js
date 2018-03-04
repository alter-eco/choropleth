import * as d3 from './d3-custom.js';

import { legendColor } from 'd3-svg-legend';
import * as topojsonClient from 'topojson-client';

import locale from './locale.json';

export class Choropleth {
  constructor(config) {
    this.format = d3.formatLocale(locale).format;

    if (config.topojson) {
      const topologyKey = Object.keys(config.topojson.objects)[0];
      this.geojson = topojsonClient.feature(config.topojson, config.topojson.objects[topologyKey]);
    } else if (config.geojson) {
      this.geojson = config.geojson;
    }

    this.valueColumn = config.valueColumn;
    this.geoIdKey = config.geoIdKey;

    this.config = {};

    this.config.neutralColor = config.neutralColor;
    this.config.numericalValues = !config.numericalValues === false;

    const margin = config.margin ? config.margin : 20;

    const rawWidth = document.documentElement.clientWidth;
    const rawHeight = document.documentElement.clientHeight;

    this.width = this.drawWidth = rawWidth - (margin * 2);
    this.height = this.drawHeight = rawHeight - (margin * 2);

    this.map = d3.select(config.elem)
      .append('svg')
      .attr('width', this.width + (margin * 2))
      .attr('height', this.height + (margin * 2))
      .append('g')
      .attr('transform', `translate(${margin},${margin})`);

    this.layer = this.map
      .append('g')
      .attr('id', 'layer');

    if (config.legend) {
      this.g = this.map.append('g')
        .attr('class', 'legend');

      this.config.legend = Object.assign({
        orientation: 'vertical',
        format: '.02f'
      }, config.legend);
    }

    this.config.scale = Object.assign({
      type: 'linear',
      minColor: 'blue',
      maxColor: 'red'
    }, config.scale);

    if (config.tooltip) {
      this.config.tooltip = Object.assign({
        prefix: '',
        suffix: ''
      }, config.tooltip);

      this.tooltip = d3.select('body').append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0);
    }

    this.setData(config.data);
  }

  showTooltip(tooltipData) {
    let number = tooltipData[this.valueColumn];

    number = number.toLocaleString('fr');

    let markup = `
    <div class="tooltip-title" style="background-color:${this.scale(tooltipData[this.valueColumn])}">
      ${tooltipData.name || tooltipData[this.geoIdKey]}
    </div>
    <div class="tooltip-item">
        ${this.config.tooltip.prefix} ${number} ${this.config.tooltip.suffix}
    </div>`;

    this.tooltip.html(markup)
      .style('left', `${d3.event.pageX}px`)
      .style('top', `${d3.event.pageY - 50}px`);

    this.tooltip.transition()
      .duration(200)
      .style('opacity', 1);
  }

  hideTooltip() {
    this.tooltip.transition()
      .duration(300)
      .style('opacity', 0);
  }

  fill(datum) {
    const geoKey = datum.properties[this.geoIdKey];

    if (this.dataById.hasOwnProperty(geoKey)) {
      return this.scale(this.dataById[geoKey][this.valueColumn]);
    }

    return this.config.neutralColor;
  }

  setData(data) {
    this.data = data;

    this.dataById = {};

    this.data.forEach(datum => {
      if (this.config.numericalValues) {
        datum[this.valueColumn] = parseInt(datum[this.valueColumn]);
      }

      this.dataById[datum[this.geoIdKey]] = datum;
    });

    this.setScale();
  }

  updateLegend() {
    if (!this.config.legend) {
      return false;
    }

    const legend = legendColor()
      .labelFormat(this.format(this.config.legend.format))
      .shapeWidth(50)
      .orient(this.config.legend.orientation)
      .scale(this.scale);

    this.map.select('.legend g')
      .remove();

    const legendSelection = this.map.select('.legend');

    legendSelection.call(legend);

    const legendHeight = legendSelection.node().getBBox().height;

    if (this.config.legend.reserveSpace) {
      this.drawHeight = this.drawHeight - legendHeight;
    }

    legendSelection.attr('transform', `translate(0,${this.height - legendHeight})`);
  }

  setScale() {
    const scaleData = this.data.map(datum => datum[this.valueColumn]);

    if (this.config.scale.type === 'linear') {
      let domain;
      let range;

      if (this.config.scale.colors) {
        domain = this.config.scale.domain;
        range = this.config.scale.colors;
      } else {
        let min = d3.min(scaleData);
        let max = d3.max(scaleData);

        domain = [min, max];
        range = [this.config.scale.minColor, this.config.scale.maxColor];
      }

      this.scale = d3.scaleLinear()
        .domain(domain)
        .range(range);
    } else if (this.config.scale.type === 'ordinal') {
      domain = scaleData.filter((value, index, self) => self.indexOf(value) === index);

      this.scale = d3.scaleOrdinal()
        .domain(domain)
        .range(this.config.scale.colors);
    }

    this.updateLegend();
  }

  draw() {
    this.updateLegend();

    const path = d3.geoPath()
      .projection(d3.geoMercator()
        .fitExtent([
          [0, 0],
          [this.drawWidth, this.drawHeight]
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
      .attr('id', d => d.properties.nom)
      .attr('fill', this.fill.bind(this))
      .on('mouseover', d => {
        if (!this.tooltip) {
          return false;
        }

        const tooltipData = this.dataById[d.properties[this.geoIdKey]];

        if (!tooltipData || tooltipData[this.selected] === '') {
          return false;
        } else {
          this.showTooltip(tooltipData);
        }
      })
      .on('mouseout', () => {
        if (!this.tooltip) {
          return false;
        }

        this.hideTooltip();
      });
  }
}
