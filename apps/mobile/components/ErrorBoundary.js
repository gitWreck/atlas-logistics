import React from "react";
import { View, Text, Button, StyleSheet } from "react-native";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // You can log the error to an error reporting service here
    // console.error(error, info);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) {
      return this.props.children || null;
    }

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong.</Text>
        <Text style={styles.message}>{String(this.state.error)}</Text>
        <Button title="Retry" onPress={this.reset} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  message: {
    marginBottom: 12,
  },
});
