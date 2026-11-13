// Register native background location task at module scope before root component mounting
import './src/services/backgroundLocationTask';
import registerRootComponent from 'expo/build/launch/registerRootComponent';
import App from './App';

registerRootComponent(App);

