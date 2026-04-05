const React = require('react');
const { Text } = require('react-native');

module.exports = function MockIonicons(props) {
  return React.createElement(
    Text,
    { testID: props.name, onPress: props.onPress },
    'icon-' + (props.name || '')
  );
};
