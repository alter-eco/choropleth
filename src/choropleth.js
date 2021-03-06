import * as d3 from './d3-custom.js';
import * as topojsonClient from 'topojson-client';
import Nanobus from 'nanobus';
import { legendColor } from 'd3-svg-legend';

import MapConfig from '@alter-eco/geo';

const locale = {
  decimal: ',',
  thousands: '.',
  grouping: [3],
  currency: ['', '\u00a0€'],
  percent: '\u202f%'
};

const maps = MapConfig();

function parseTopo(topojson) {
  const topologyKey = Object.keys(topojson.objects)[0];

  return topojsonClient.feature(topojson, topojson.objects[topologyKey]);
}

export class Choropleth extends Nanobus {
  constructor(params) {
    super();

    this.d3 = d3;

    this.format = d3.formatLocale(locale).format;

    this.valueColumn = params.valueColumn ? params.valueColumn : 'value';

    this.config = {};

    this.config.neutralColor = params.neutralColor ? params.neutralColor : '#ccc';
    this.config.numericalValues = !params.numericalValues === false;

    const margin = params.margin ? params.margin : 20;

    const rawWidth = document.documentElement.clientWidth;
    const rawHeight = document.documentElement.clientHeight;

    this.width = this.drawWidth = params.width ? params.width - (margin * 2) : rawWidth - (margin * 2);
    this.height = this.drawHeight = params.height ? params.height - (margin * 2) : rawHeight - (margin * 2);

    this.map = d3.select(params.elem)
      .append('svg')
      .attr('width', this.width + (margin * 2))
      .attr('height', this.height + (margin * 2))
      .append('g')
      .attr('transform', `translate(${margin},${margin})`);

    this.layer = this.map
      .append('g')
      .attr('id', 'layer');

    if (params.legend) {
      this.g = this.map.append('g')
        .attr('class', 'legend');

      this.config.legend = Object.assign({
        orientation: 'vertical',
        format: '.02f'
      }, params.legend);

      this.on('setScale', () => this.updateLegend());
      this.on('draw', () => this.updateLegend());
    }

    if (typeof params.scale == 'function') {
      this.config.scale = { type: 'custom' };
      this.scale = params.scale;
    } else {
      this.config.scale = Object.assign({
        type: 'linear',
        minColor: 'blue',
        maxColor: 'red'
      }, params.scale);
    }

    if (params.tooltip) {
      this.config.tooltip = Object.assign({
        prefix: '',
        suffix: ''
      }, params.tooltip);

      this.tooltip = d3.select('body').append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0);

      this.on('mouseover', d => {
        const tooltipData = this.dataById[d.properties[this.geoIdKey]];

        if (!tooltipData || tooltipData[this.selected] === '') {
          return false;
        } else {
          this.showTooltip(tooltipData);
        }
      });

      this.on('mouseout', this.hideTooltip.bind(this));
    }

    if (params.map && maps.hasOwnProperty(params.map)) {
      const mapConfig = maps[params.map];

      this.geoIdKey = mapConfig.key;

      this.projection = d3[mapConfig.projection] ? d3[mapConfig.projection]() : d3.geoMercator();

      this.mapFetch = fetch(mapConfig.path)
        .then(res => res.json())
        .then(topojson => {
          this.topojson = topojson;
          this.geojson = parseTopo(topojson);
        });
    } else {
      this.geoIdKey = params.geoIdKey;
      this.topojson = params.topojson;
      this.geojson = params.topojson ? parseTopo(params.topojson) : params.geosjon;
      this.projection = params.projection || d3.geoMercator();
    }

    this.setData(params.data);

    this.ready().then(() => { this.draw(); });
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
      .style('position', 'absolute')
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

    if (this.config.scale.type === 'custom') {
      return false;
    } else if (this.config.scale.type === 'linear') {
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
      let domain = scaleData.filter((value, index, self) => self.indexOf(value) === index);

      this.scale = d3.scaleOrdinal()
        .domain(domain)
        .range(this.config.scale.colors);
    }

    this.emit('setScale');
  }

  ready() {
    if (this.mapFetch) {
      return this.mapFetch;
    }

    return Promise.resolve();
  }

  draw() {
    this.path = d3.geoPath()
      .projection(this.projection
        .fitExtent([
          [0, 0],
          [this.drawWidth, this.drawHeight]
        ], this.geojson));

    this.layerSelect = this.layer
      .selectAll('path')
      .data(this.geojson.features);

    // enters
    this.layerSelect
      .enter()
      .append('path')
      .attr('d', this.path)
      .attr('fill', this.fill.bind(this))
      .on('mouseover', d => this.emit('mouseover', d))
      .on('mouseout', () => this.emit('mouseout'));

    this.emit('draw');
  }
}
