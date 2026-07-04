import "react-native-get-random-values";
import { AppRegistry } from "react-native";
import { name as appName } from "./app.json";
import { MyDropAlphaApp } from "./src/App";

AppRegistry.registerComponent(appName, () => MyDropAlphaApp);
