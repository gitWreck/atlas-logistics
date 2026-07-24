import React from 'react';
import { View, Text, ScrollView } from 'react-native';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error Boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#fff', padding: 20, justifyContent: 'center' }}>
          <ScrollView>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: 'red', marginBottom: 10 }}>
              ⚠️ App Error
            </Text>
            <Text style={{ fontSize: 14, color: '#666', marginBottom: 10, fontFamily: 'monospace' }}>
              {this.state.error?.toString()}
            </Text>
            <Text style={{ fontSize: 12, color: '#999', fontFamily: 'monospace' }}>
              {this.state.error?.stack}
            </Text>
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}
