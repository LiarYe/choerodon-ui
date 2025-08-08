import React, { cloneElement, FunctionComponent, isValidElement, MouseEventHandler, ReactNode, useCallback, useContext, useEffect, useRef, CSSProperties, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { isArrayLike } from 'mobx';
import classnames from 'classnames';
import { DraggableProvided } from 'react-beautiful-dnd';
import isString from 'lodash/isString';
import isFunction from 'lodash/isFunction';
import isObject from 'lodash/isObject';
import noop from 'lodash/noop';
import { Size } from 'choerodon-ui/lib/_util/enum';
import { pxToRem } from 'choerodon-ui/lib/_util/UnitConvertor';
import { AttachmentConfig } from 'choerodon-ui/lib/configure';
import ConfigContext from 'choerodon-ui/lib/config-provider/ConfigContext';
import { ProgressStatus } from 'choerodon-ui/lib/progress/enum';
import { AttachmentFileProps } from 'choerodon-ui/dataset/configure';
import Popconfirm, { PopconfirmProps } from 'choerodon-ui/lib/popconfirm';
import Progress from '../progress/Progress';
import Icon from '../icon';
import AttachmentFile from '../data-set/AttachmentFile';
import { AttachmentButtons, AttachmentButtonType, AttachmentListType } from './Attachment';
import Picture, { PictureForwardRef, PictureProps } from '../picture/Picture';
import Button, { ButtonProps } from '../button/Button';
import { FuncType } from '../button/enum';
import { hide, show } from '../tooltip/singleton';
import { formatFileSize } from './utils';
import Tooltip from '../tooltip/Tooltip';
import { $l } from '../locale-context';
import { TableButtonProps } from '../table/interface';
import isOverflow from '../overflow-tip/util';

export const ATTACHMENT_TARGET = 'attachment-preview';

export interface ItemProps {
  attachment: AttachmentFile;
  onUpload: (attachment: AttachmentFile) => void;
  onHistory?: (attachment: AttachmentFile, attachmentUUID: string) => void;
  onPreview?: () => void;
  onRemove: (attachment: AttachmentFile) => Promise<any> | undefined;
  readOnly?: boolean;
  disabled?: boolean;
  isCard?: boolean;
  prefixCls?: string;
  pictureWidth?: number;
  restCount?: number;
  index?: number;
  listType?: AttachmentListType;
  bucketName?: string;
  bucketDirectory?: string;
  storageCode?: string;
  showSize?: boolean;
  attachmentUUID?: string;
  provided: DraggableProvided;
  draggable?: boolean;
  hidden?: boolean;
  isPublic?: boolean;
  previewTarget?: string;
  buttons?: AttachmentButtons[];
  getPreviewUrl?: (props: AttachmentFileProps) => (string | (() => string | Promise<string>) | undefined);
  removeConfirm?: boolean | PopconfirmProps;
  getDownloadUrl?: (props: AttachmentFileProps) => string | Function | undefined;
}

const Item: FunctionComponent<ItemProps> = function Item(props) {
  const {
    attachment, listType, prefixCls, onUpload, onRemove, pictureWidth: width, bucketName, onHistory, onPreview = noop, previewTarget = ATTACHMENT_TARGET,
    bucketDirectory, storageCode, attachmentUUID, isCard, provided, readOnly, disabled, restCount, draggable, index, hidden, isPublic, showSize, buttons: fileButtons,
    getPreviewUrl: getPreviewUrlProp, getDownloadUrl: getDownloadUrlProp,
  } = props;
  const { status, name, filename, ext, url, size, type } = attachment;
  const { getConfig, getTooltipTheme, getTooltipPlacement } = useContext(ConfigContext);
  const attachmentConfig: AttachmentConfig = getConfig('attachment');
  const tooltipRef = useRef<boolean>(false);
  const pictureRef = useRef<PictureForwardRef | null>(null);
  const { getPreviewUrl: getPreviewUrlConfig, getDownloadUrl: getDownloadUrlConfig } = attachmentConfig;
  const getPreviewUrl = getPreviewUrlProp || getPreviewUrlConfig;
  const getDownloadUrl = getDownloadUrlProp || getDownloadUrlConfig;
  const previewUrl = useMemo(() => {
    if (getPreviewUrl) {
      return getPreviewUrl({ attachment, bucketName, bucketDirectory, storageCode, attachmentUUID, isPublic });
    }
    return url;
  }, [getPreviewUrl, attachment, bucketName, bucketDirectory, storageCode, attachmentUUID, isPublic, url]);
  const downloadUrl: string | Function | undefined = getDownloadUrl && getDownloadUrl({
    attachment,
    bucketName,
    bucketDirectory,
    storageCode,
    attachmentUUID,
    isPublic,
  });
  const dragProps = { ...provided.dragHandleProps };
  const isPicture = type.startsWith('image') || ['png', 'gif', 'jpg', 'webp', 'jpeg', 'bmp', 'tif', 'pic', 'svg'].includes(ext);
  const preview = !!previewUrl && (status === 'success' || status === 'done');
  const handleOpenPreview = useCallback(async () => {
    if (isFunction(previewUrl)) {
      const result = await previewUrl();
      if (isString(result)) {
        window.open(result, previewTarget);
      }
    }
  }, [previewUrl, previewTarget]);
  const handlePreview = useCallback(() => {
    const { current } = pictureRef;
    if (current && isString(previewUrl)) {
      current.preview();
      onPreview();
    } else if (isFunction(previewUrl)) {
      handleOpenPreview();
    }
  }, [pictureRef, previewUrl, handleOpenPreview]);
  const renderDragger = (): ReactNode => {
    if (draggable && !isCard) {
      const iconProps = {
        className: `${prefixCls}-drag-icon`,
        type: 'baseline-drag_indicator',
      };
      if (status !== 'deleting') {
        Object.assign(iconProps, dragProps);
      }
      return (
        <Icon {...iconProps} />
      );
    }
  };
  const renderImagePreview = (): ReactNode => {
    if (!listType) return;
    const { renderIcon } = attachmentConfig;
    const defaultIcon = <Icon type="insert_drive_file" />;
    let icon = renderIcon ? renderIcon(attachment, listType, defaultIcon) : defaultIcon;
    icon = icon === undefined ? defaultIcon : icon;
    const isSrcIcon = isString(icon);
    if (listType === 'text' || ((isCard || listType === 'picture') && !isPicture)) {
      if (isPicture || isSrcIcon) {
        const pictureProps: PictureProps = {};
        if (isString(previewUrl)) {
          pictureProps.previewUrl = previewUrl;
        } else {
          pictureProps.onClick = handleOpenPreview;
        }
        return (
          <Picture
            width={14}
            height={14}
            alt={name}
            downloadUrl={downloadUrl}
            src={isSrcIcon ? icon as string : undefined}
            objectFit="contain"
            status="loaded"
            index={index}
            className={`${prefixCls}-icon`}
            previewTarget={isSrcIcon && !isPicture ? previewTarget : undefined}
            preview={preview}
            onPreview={onPreview}
            ref={pictureRef}
            {...pictureProps}
          >
            {isValidElement(icon) ? icon : undefined}
          </Picture>
        );
      }
      let cardOtherFilestyle: CSSProperties = {};
      if (isCard) {
        cardOtherFilestyle = {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: pxToRem(width),
          height: pxToRem(width),
        };
      }
      if (preview) {
        const previewButtonProps: ButtonProps = {
          funcType: FuncType.link,
          className: `${prefixCls}-icon`,
        };
        if (isString(previewUrl)) {
          previewButtonProps.href = previewUrl;
          previewButtonProps.target = previewTarget;
        } else {
          previewButtonProps.onClick = handleOpenPreview;
        }
        return (
          <Button {...previewButtonProps} style={cardOtherFilestyle}>
            {icon}
          </Button>
        );
      }
      return (
        <div className={`${prefixCls}-icon`} style={cardOtherFilestyle}>
          {icon}
        </div>
      );
    }
    if (isCard || listType === 'picture') {
      if ((preview || status === 'deleting') && isPicture) {
        return (
          <Picture
            onClick={() => onPreview()}
            width={width}
            height={width}
            alt={name}
            src={isString(previewUrl) ? previewUrl : url}
            downloadUrl={downloadUrl}
            lazy
            objectFit="contain"
            index={index}
            preview={preview}
            ref={pictureRef}
          />
        );
      }
      return (
        <Picture
          onClick={() => onPreview()}
          width={width}
          height={width}
          alt={name}
          status={status === 'error' ? 'error' : 'empty'}
          index={index}
        />
      );
    }
  };
  const renderPlaceholder = (): ReactNode => {
    if (restCount && isCard) {
      return (
        <div className={`${prefixCls}-placeholder`}>
          +{restCount}
        </div>
      );
    }
  };
  const renderTitle = (isCardTitle?: boolean): ReactNode => {
    const fileName = (
      <>
        <span className={`${prefixCls}-name`}>{filename}</span>
        {ext && <span className={`${prefixCls}-ext`}>.{ext}</span>}
      </>
    );
    const nameNode = preview && (listType === 'text' || listType === 'picture') ? (
      <a
        {
          ...isPicture ? { onClick: handlePreview } : isString(previewUrl) ? {
            href: previewUrl,
            target: previewTarget,
          } : { onClick: handleOpenPreview }
        }
        className={`${prefixCls}-link`}
      >
        {fileName}
      </a>
    ) : fileName;
    return (
      <span className={`${prefixCls}-title`} style={isCardTitle ? { width: pxToRem(width) } : undefined}>
        {nameNode}
        {!isCardTitle && showSize && <span className={`${prefixCls}-size`}> ({formatFileSize(size)})</span>}
      </span>
    );
  };
  const renderProgress = (): ReactNode => {
    if (status === 'uploading') {
      return (
        <Progress
          value={attachment.percent || 0}
          size={Size.small}
          showInfo={false}
          strokeWidth={2}
          className={`${prefixCls}-progress`}
          status={ProgressStatus.normal}
        />
      );
    }
  };


  const getButtonProps = (type: AttachmentButtonType)
    : ButtonProps & { onClick: MouseEventHandler<any>; children?: ReactNode } | undefined => {
    const commonProps = {
      className: classnames(`${prefixCls}-icon`),
      funcType: FuncType.link,
      block: isCard,
    }
    switch (type) {
      case AttachmentButtonType.download:
        return {
          ...commonProps,
          icon: isCard ? 'arrow_downward' : 'get_app',
          href: isString(downloadUrl) ? downloadUrl : undefined,
          onClick: isFunction(downloadUrl) ? downloadUrl : noop,
          target: previewTarget,
        }
      case AttachmentButtonType.remove:
        return {
          ...commonProps,
          icon: isCard ? 'delete_forever-o' : 'close',
          onClick: () => onRemove(attachment),
        }
      case AttachmentButtonType.history:
        if (onHistory && attachmentUUID) {
          return {
            ...commonProps,
            icon: 'library_books',
            onClick: () => onHistory(attachment, attachmentUUID),
          }
        }
        return { onClick: noop };
      default:
        break;
    }
  }

  const renderButtons = (): ReactNode => {
    const { removeConfirm } = props;
    const popconfirmProps = {
      title: $l('Attachment', 'remove_confirm_title'),
      ...(typeof removeConfirm !== 'boolean' ? removeConfirm : {}),
    };
    const buttons: ReactNode[] = [];
    if (!readOnly && status === 'error' && !attachment.invalid) {
      const upProps = {
        key: 'upload',
        className: classnames(`${prefixCls}-icon`),
        icon: 'replay',
        onClick: () => onUpload(attachment),
        funcType: FuncType.link,
        block: isCard,
      };
      buttons.push(<Button {...upProps} />);
    }

    fileButtons!.forEach(btn => {
      let btnProps: TableButtonProps = {};
      if (isArrayLike(btn)) {
        btnProps = (btn[1] as TableButtonProps) || {};
        btn = btn[0] as AttachmentButtonType;
      }
      if (isString(btn) && btn in AttachmentButtonType) {
        const defaultButtonProps = getButtonProps(btn);
        if (defaultButtonProps) {
          const index = fileButtons!.indexOf(btn);
          switch (btn) {
            case AttachmentButtonType.history:
              if (attachmentUUID && onHistory && (!status || status === 'success' || status === 'done')) {
                buttons.splice(
                  index,
                  1,
                  <Tooltip key={btn} title={$l('Attachment', 'view_operation_records')}>
                    <Button
                      {...defaultButtonProps}
                      {...btnProps}
                    />
                  </Tooltip>,
                );
              }
              break;
            case AttachmentButtonType.download:
              if (downloadUrl && (!status || status === 'success' || status === 'done')) {
                buttons.splice(
                  index,
                  1,
                  <Tooltip key={btn} title={$l('Attachment', 'download')}>
                    <Button
                      {...defaultButtonProps}
                      {...btnProps}
                    />
                  </Tooltip>,
                );
              }
              break;
            case AttachmentButtonType.remove:
              if (attachmentUUID && status !== 'uploading') {
                buttons.splice(
                  index,
                  1,
                  removeConfirm
                    ? (
                      <Tooltip key={btn} title={status === 'deleting' ? undefined : $l('Attachment', 'delete')}>
                        <Popconfirm
                          overlayClassName={`${prefixCls}-remove-confirm-popover`}
                          onConfirm={({ ...defaultButtonProps, ...btnProps }).onClick}
                          onCancel={noop}
                          {...popconfirmProps}
                        >
                          <Button
                            hidden={readOnly || disabled}
                            {...defaultButtonProps}
                            {...btnProps}
                            onClick={noop}
                          />
                        </Popconfirm>
                      </Tooltip>
                    )
                    : (
                      <Tooltip key={btn} title={status === 'deleting' ? undefined : $l('Attachment', 'delete')}>
                        <Button
                          hidden={readOnly || disabled}
                          {...defaultButtonProps}
                          {...btnProps}
                        />
                      </Tooltip>
                    ),
                );
              }
              break;
            default:
              break;
          }
        }
      } else if (isValidElement<ButtonProps>(btn)) {
        buttons.push(cloneElement(btn, { ...btn.props }));
      } else if (isFunction(btn)) {
        const customButton = btn({ attachment, bucketName, bucketDirectory, storageCode, attachmentUUID, isPublic, readOnly, disabled });
        if (isValidElement<ButtonProps>(customButton)) {
          buttons.push(customButton);
        }
      } else if (isObject(btn)) {
        buttons.push(<Button {...(btn as TableButtonProps)} />);
      }
    });

    if (buttons.length) {
      return (
        <div className={classnames(`${prefixCls}-buttons`, { [`${prefixCls}-buttons-visible`]: status === 'deleting' })}>
          {buttons}
        </div>
      );
    }
  };
  const renderErrorMessage = (showTooltip?: boolean): ReactNode => {
    if (status === 'error') {
      const { errorMessage } = attachment;
      if (errorMessage) {
        return (
          <div className={`${prefixCls}-error-content`}>
            <Icon type="warning" />
            <span
              className={`${prefixCls}-error-message`}
              onMouseEnter={showTooltip ? handleMouseEnter : undefined}
              onMouseLeave={showTooltip ? handleMouseLeave : undefined}
            >
              {errorMessage}
            </span>
          </div>
        );
      }
    }
  };
  const errorMessageNode = renderErrorMessage();
  const handleMouseEnter = useCallback((e) => {
    if (errorMessageNode && (isCard || isOverflow(e.currentTarget))) {
      show(e.currentTarget, {
        title: errorMessageNode,
        theme: getTooltipTheme('validation'),
        placement: getTooltipPlacement('validation') || 'bottomLeft',
      });
      tooltipRef.current = true;
    }
  }, [errorMessageNode, getTooltipTheme, getTooltipPlacement, tooltipRef, isCard]);
  const handleMouseLeave = useCallback(() => {
    if (tooltipRef.current) {
      hide();
      tooltipRef.current = false;
    }
  }, [tooltipRef]);

  useEffect(() => () => {
    if (tooltipRef.current) {
      hide();
      tooltipRef.current = false;
    }
  }, []);

  const listProps = {
    ref: provided.innerRef,
    className: classnames(prefixCls, {
      [`${prefixCls}-error`]: status === 'error',
      [`${prefixCls}-success`]: status === 'success',
    }),
    ...provided.draggableProps,
    style: {
      ...provided.draggableProps.style,
    },
  };
  if (draggable && isCard) {
    Object.assign(listProps, dragProps);
  }
  return (
    <div {...listProps} hidden={hidden}>
      <div
        className={`${prefixCls}-container`}
        onMouseEnter={isCard ? handleMouseEnter : undefined}
        onMouseLeave={isCard ? handleMouseLeave : undefined}
      >
        <div className={`${prefixCls}-content`}>
          {renderDragger()}
          {renderImagePreview()}
          {renderPlaceholder()}
          {!restCount && !isCard && renderTitle()}
          {!restCount && renderButtons()}
        </div>
        {renderErrorMessage(!isCard)}
        {renderProgress()}
      </div>
      {!restCount && isCard && renderTitle(true)}
    </div>
  );
};

Item.displayName = 'Item';

export default observer(Item);
