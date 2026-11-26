import React, { Component } from 'react';
import * as ReactDOM from 'react-dom';
import classNames from 'classnames';
import isString from 'lodash/isString';
import isArray from 'lodash/isArray';
import isObject from 'lodash/isObject';
import toString from 'lodash/toString';
import isNil from 'lodash/isNil';
import getUid from './uid';
import warning from '../../_util/warning';
import acceptsHostRef from '../../_util/acceptsHostRef';

const IFRAME_STYLE = {
  position: 'absolute',
  top: 0,
  opacity: 0,
  filter: 'alpha(opacity=0)',
  left: 0,
  zIndex: 9999,
};

function toStringValue(value) {
  if (isNil(value)) return '';
  if (isString(value)) return value;
  if (isObject(value)) return JSON.stringify(value);
  return toString(value);
}

function requestFileInput(requestFileKeys, file, data) {
  const inputs = document.createDocumentFragment();
  if (data) {
    Object.keys(data).forEach(key => {
      const input = document.createElement('input');
      input.setAttribute('name', key);
      input.value = data[key];
      inputs.appendChild(input);
    });
  }
  if (isString(requestFileKeys) || isArray(requestFileKeys)) {
    ['uid', 'type', 'name', 'lastModifiedDate'].concat(requestFileKeys).forEach(item => {
      const key = toStringValue(item);
      const input = document.createElement('input');
      input.setAttribute('name', key);
      input.value = toStringValue(file[key]);
      inputs.appendChild(input);
    });
  }
  return inputs;
}

class IframeUploader extends Component {
  state = { uploading: false };

  rootRef = React.createRef();

  // Keep the event guard synchronous even when React batches setState.
  uploading = false;

  file = {};

  componentDidMount() {
    this.updateIframeWH();
    this.initIframe();
  }

  componentDidUpdate() {
    this.updateIframeWH();
  }

  onLoad = () => {
    if (!this.uploading) return;
    const { props, file } = this;
    try {
      const doc = this.getIframeDocument();
      const script = doc.getElementsByTagName('script')[0];
      if (script && script.parentNode === doc.body) {
        doc.body.removeChild(script);
      }
      props.onSuccess(doc.body.innerHTML, file);
    } catch (err) {
      warning(false, 'cross domain error for Upload. Maybe server should return document.domain script. see Note from https://github.com/react-component/upload');
      props.onError(err, null, file);
    }
    this.endUpload();
  };

  onChange = () => {
    const target = this.getFormInputNode();
    // IE8/9 do not support FileList.
    const file = { uid: getUid(), name: target.value };
    this.file = file;
    this.startUpload();
    const { beforeUpload } = this.props;
    if (!beforeUpload) {
      this.post(file);
      return;
    }
    const before = beforeUpload(file);
    if (before && before.then) {
      before.then(() => this.post(file), () => this.endUpload());
    } else if (before !== false) {
      this.post(file);
    } else {
      this.endUpload();
    }
  };

  onClick = (e) => {
    const el = this.getFormInputNode();
    if (!el || e.target === el) return;
    const { fileInputClick } = this.props;
    if (fileInputClick) {
      fileInputClick(el);
    } else {
      el.click();
    }
  };

  getIframeNode() {
    return this.iframe;
  }

  getIframeDocument() {
    return this.getIframeNode().contentDocument;
  }

  getFormNode() {
    return this.getIframeDocument().getElementById('form');
  }

  getFormInputNode() {
    return this.getIframeDocument().getElementById('input');
  }

  getFormDataNode() {
    return this.getIframeDocument().getElementById('data');
  }

  getFileForMultiple(file) {
    const { multiple } = this.props;
    return multiple ? [file] : file;
  }

  getIframeHTML(domain) {
    const { name } = this.props;
    let domainScript = '';
    let domainInput = '';
    if (domain) {
      const script = 'script';
      domainScript = `<${script}>document.domain="${domain}";</${script}>`;
      domainInput = `<input name="_documentDomain" value="${domain}" />`;
    }
    return `
    <!DOCTYPE html>
    <html>
    <head>
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <style>
    body,html {padding:0;margin:0;border:0;overflow:hidden;}
    </style>
    ${domainScript}
    </head>
    <body>
    <form method="post"
    encType="multipart/form-data"
    action="" id="form"
    style="display:block;height:9999px;position:relative;overflow:hidden;">
    <input id="input" type="file"
     name="${name}"
     style="position:absolute;top:0;right:0;height:9999px;font-size:9999px;cursor:pointer;"/>
    ${domainInput}
    <span id="data"></span>
    </form>
    </body>
    </html>
    `;
  }

  initIframeSrc() {
    if (this.domain) {
      this.getIframeNode().src = `javascript:void((function(){
        var d = document;
        d.open();
        d.domain='${this.domain}';
        d.write('');
        d.close();
      })())`;
    }
  }

  initIframe() {
    const iframeNode = this.getIframeNode();
    let win = iframeNode.contentWindow;
    let doc;
    this.domain = this.domain || '';
    this.initIframeSrc();
    try {
      doc = win.document;
    } catch {
      this.domain = document.domain;
      this.initIframeSrc();
      win = iframeNode.contentWindow;
      doc = win.document;
    }
    doc.open('text/html', 'replace');
    doc.write(this.getIframeHTML(this.domain));
    doc.close();
    this.getFormInputNode().onchange = this.onChange;
  }

  endUpload() {
    if (this.uploading) {
      this.file = {};
      this.uploading = false;
      this.setState({ uploading: false });
      this.initIframe();
    }
  }

  startUpload() {
    if (!this.uploading) {
      this.uploading = true;
      this.setState({ uploading: true });
    }
  }

  updateIframeWH() {
    const iframe = this.getIframeNode();
    const { current } = this.rootRef;
    const { findDOMNode } = ReactDOM;
    const root = current && current.nodeType === 1 ? current : findDOMNode && findDOMNode(this);
    // Without an exposed host on React 19, follow the CSS containing block instead.
    iframe.style.width = root ? `${root.offsetWidth}px` : '100%';
    iframe.style.height = root ? `${root.offsetHeight}px` : '100%';
  }

  abort(file) {
    if (!file || (file.uid || file) === this.file.uid) this.endUpload();
  }

  post(file) {
    const formNode = this.getFormNode();
    const dataSpan = this.getFormDataNode();
    const { data, requestFileKeys, onStart, action } = this.props;
    dataSpan.appendChild(requestFileInput(requestFileKeys, file, typeof data === 'function' ? data(file) : data));
    new Promise(resolve => {
      resolve(typeof action === 'function' ? action(file) : action);
    }).then(url => {
      formNode.setAttribute('action', url);
      formNode.submit();
      dataSpan.innerHTML = '';
      onStart(file);
    });
  }

  saveIframe = (node) => {
    this.iframe = node;
  };

  render() {
    const {
      component: Tag, disabled, className,
      prefixCls, children, style,
    } = this.props;
    const { uploading } = this.state;
    const iframeStyle = {
      ...IFRAME_STYLE,
      display: uploading || disabled ? 'none' : '',
    };
    const cls = classNames({
      [prefixCls]: true,
      [`${prefixCls}-disabled`]: disabled,
      [className]: className,
    });
    return (
      <Tag
        ref={acceptsHostRef(Tag) ? this.rootRef : undefined}
        onClick={this.onClick}
        className={cls}
        style={{ position: 'relative', zIndex: 0, ...style }}
      >
        <iframe
          title="File upload"
          ref={this.saveIframe}
          onLoad={this.onLoad}
          style={iframeStyle}
        />
        {children}
      </Tag>
    );
  }
}

export default IframeUploader;
