import React from 'react';
import { AppRegistry } from 'react-native';
import App from './App';
import './index.css';

AppRegistry.registerComponent('WelliRecord', () => App);

const rootTag = document.getElementById('root');
if (rootTag) {
  AppRegistry.runApplication('WelliRecord', {
    initialProps: {},
    rootTag,
  });
}
