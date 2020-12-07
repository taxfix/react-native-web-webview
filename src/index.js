import Qs from 'qs';
import React, { Component } from 'react';
import { StyleSheet, View, ActivityIndicator, unstable_createElement as createElement } from 'react-native';

export class WebView extends Component {
  static defaultProps = {
    scrollEnabled: true,
  };

  constructor(props) {
    super(props);
    
    this.state = {
      html: props.source.html,
      baseUrl: props.source.baseUrl,
      injectedJavaScript: props.injectedJavaScript,
    }

    if (props.source.uri) {
      if (props.newWindow) {
        this.handleSourceInNewWindow(props.source, props.newWindow);
      } else {
        this.handleSourceInIFrame(props.source);
      }
    }
  }

  setRef = (ref) => (this.frameRef = ref);

  handleSourceInIFrame = (source) => {
    const { uri, ...options } = source;
    const baseUrl = uri.substr(0, uri.lastIndexOf('/') + 1);
    fetch(uri, options)
      .then(response => response.text())
      .then(html => this.setState({ html, baseUrl }));
  };

  getSourceDocument = () => {
    const { html, baseUrl, injectedJavaScript } = this.state;
    if (!html) return html;

    let doc = '';
    if (baseUrl) {
      doc += `<base href="${baseUrl}" />`;
    }
    if (html) {
      doc += html;
    }
    if (this.props.onMessage) {
      doc = doc.replace('</body>', `<script>window.ReactNativeWebView = window.parent;</script></body>`);
    }
    if (this.props.onLoadEnd) {
      doc = doc.replace('</body>', `<script>document.addEventListener("DOMContentLoaded", function () { window.parent.postMessage('DOMContentLoaded'); })</script></body>`);
    }
    if (injectedJavaScript) {
      doc = doc.replace('</body>', `<script>${injectedJavaScript}</script></body>`);
    }

    return doc;
  }

  handleSourceInNewWindow = (source, newWindow) => {
    if (source.method === 'POST') {
      const contentType = source.headers['Content-Type'];
      let body = '';
      if (contentType && contentType.includes('application/x-www-form-urlencoded')) {
        body = Qs.parse(source.body);
      } else {
        console.warn(
          '[WebView] When opening a new window, this content-type is not supported yet, please make a PR!',
          contentType
        );
        return;
      }

      window.open(
        require('./postMock.html') +
          '?' +
          Qs.stringify({
            uri: source.uri,
            body: JSON.stringify(body),
          }),
        newWindow.name || 'webview',
        newWindow.features || undefined
      );
    } else {
      console.warn(
        '[WebView] When opening a new window, this method is not supported yet, please make a PR!',
        source.method
      );
    }
  };

  componentDidMount() {
    if (typeof this.props.onMessage === 'function' || typeof this.props.onLoadEnd === 'function') {
      window.addEventListener('message', this.onMessage, true);
    }
  }

  componentWillReceiveProps(nextProps) {
    if (
      this.props.source.uri !== nextProps.source.uri ||
      this.props.source.method !== nextProps.source.method ||
      this.props.source.body !== nextProps.source.body ||
      this.props.source.html !== nextProps.source.html ||
      this.props.source.baseUrl !== nextProps.source.baseUrl
    ) {
      this.handleSource(nextProps.source, nextProps.newWindow);
    }
  }

  componentWillUnmount() {
    window.removeEventListener('message', this.onMessage, true);
  }

  onMessage = (nativeEvent) => {
    if (typeof this.props.onLoadEnd === 'function' && nativeEvent.data === 'DOMContentLoaded') {
      this.props.onLoadEnd();
    } else if (typeof this.props.onMessage === 'function') {
      this.props.onMessage({ nativeEvent })
    }
  };

  postMessage = (message, origin) => {
    this.frameRef.contentWindow.postMessage(message, origin);
  };

  injectJavaScript = (expression) => {
    this.frameRef.contentWindow.Function(`"use strict"; return ${expression};`)();
  };

  render() {
    if (this.props.newWindow) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator />
        </View>
      );
    }

    const { title, source, onLoad, scrollEnabled } = this.props;
    const styleObj = StyleSheet.flatten(this.props.style);
    return createElement('iframe', {
      title,
      ref: this.setRef,
      srcDoc: this.getSourceDocument(),
      width: styleObj && styleObj.width,
      height: styleObj && styleObj.height,
      style: StyleSheet.flatten([styles.iframe, scrollEnabled && styles.noScroll, this.props.style]),
      allowFullScreen: true,
      allowpaymentrequest: 'true',
      frameBorder: '0',
      seamless: true,
      onLoad,
    });
  }
}

export default WebView;

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iframe: {
    width: '100%',
    height: '100%',
    borderWidth: 0,
  },
  noScroll: {
    overflow: 'hidden',
  },
});
