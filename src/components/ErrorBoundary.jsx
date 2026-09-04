import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
          <div className="max-w-md w-full text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">Something went wrong</h1>
              <p className="text-muted-foreground mt-2 text-sm">
                An unexpected error occurred. Please refresh the page or go back to continue.
              </p>
              {this.state.error?.message && (
                <p className="mt-3 text-xs text-muted-foreground font-mono bg-muted rounded-lg px-3 py-2">
                  {this.state.error.message}
                </p>
              )}
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => window.history.back()}>Go Back</Button>
              <Button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}>
                <RefreshCw className="w-4 h-4 mr-2" /> Reload
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}