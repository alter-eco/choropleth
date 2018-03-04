import { Choropleth } from './src/choropleth';

export default {
  create(config) {
    const choropleth = new Choropleth(config);

    return choropleth;
  }
};
