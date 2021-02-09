/**
 *
 * @file sc-table.js
 *
 */

class ScTable {

    /**
     * 选择器
     */
    selector = '';

    /**
     * 异步接口地址
     */
    apiUrl = '';

    /**
     * 默认选择项
     */
    selected = new Set();

    /**
     * 数据
     */
    data = {};

    /**
     * 显示字段
     */
    columns = {}

    /**
     * 对象值
     */
    value = {};

    /**
     * 请求参数
     */
    queryParams = {};

    /**
     * 表格高度
     */
    height = 400;


    // 基本类选择器
    _Class = 'sc-table';
    _HeaderClass = 'sc-table-header';
    _HeaderLablesClass = 'sc-table-labels';
    _LabelCloseClass= 'sc-table-label-close';
    _ContainerClass = 'sc-table-container';
    _TableClass = 'sc-table-table';
    _TableAllCheckboxClass = 'sc-table-table-checkbox-all';
    _TableRowCheckboxClass = 'sc-table-table-checkbox-row';
    _TableToolPanelClass = 'sc-table-tool-panel';
    _TableSearchClass = 'sc-table-search-input';

    /**
     * 页数
     */
    _Page = 1;

    /**
     * 每页记录数
     */
    _PageSize = 10;

    /**
     * 数据主键
     */
    _PkName = 'id';

    /**
     * 数据标签
     */
    _TitleName = 'name';

    /**
     * 记录滚动位置 ： 防止重复获取
     */
    _ScrollBtmPointer = 0;

    /**
     * 加载状态
     */
    _Loading = false;

    /**
     * 加载时提示
     */
    _LoadingHtml = `<div class="sc-table-loading">正在加载数据...</div>`;

    /**
     *
     * @param {*} selector
     * @param {*} apiUrl
     * @param {*} selected
     * @param {*} queryParams
     * @param {*} columns
     * @param {*} height
     */
    constructor(selector, apiUrl, selected = [], queryParams = {}, columns = [], height = 400) {
        // 基本参数信息
        this.selector = selector;
        this.selected = new Set(selected);
        this.queryParams = queryParams;
        this.columns = columns;
        this.height = height;

        // 初始化标题栏信息
        this.initColumn();

        if (typeof(apiUrl) == 'string') {
            this.apiUrl = apiUrl;
        } else {
            for(let key in apiUrl){
                let item = apiUrl[key];
                this.data[item[this._PkName]] = item;
            }
        }

        // 初始化界面
        this.initHtml();

        // 渲染默认组件
        this.initDefaultSelected();

    }

    /**
     * 初始化显示栏目数据
     */
    initColumn() {
        const oldThis = this;

        this.columns.forEach((v, k) => {
            if(v.hasOwnProperty('pk') && v['pk']) {
                oldThis._PkName = v['field']
            } else if(v.hasOwnProperty('name') && v['name']) {
                oldThis._TitleName = v['field'];
            }
        });
    }

    /**
     * 初始化HTML
     */
    initHtml() {
        let html = `
        <div class="${this._HeaderClass}">
            <div class="${this._HeaderLablesClass}"></div>
        </div>
        <div class="${this._ContainerClass}">
            <div class="${this._TableToolPanelClass}">
                <input name="search" type="text" placeholder="搜索关键字..." class="${this._TableSearchClass}">
            </div>
            <table class="${this._TableClass}" >
                <thead></thead>
                <tbody style="height:${this.height}px"></tbody>
            </table>
        </div>
        `;

        $(this.selector).addClass(this._Class).html(html);

        this.initTableHtml();

        this.listenEvents();
    }

    /**
     * 格式化请求参数
     *
     * @param {Object} params
     */
    getFormatParams(params) {
        let _queryParams = this.queryParams;
        let tmpParams = {};
        if (_queryParams.hasOwnProperty('params')) {
            tmpParams = _queryParams.params;
        }

        // 如果是字符串，那么就要转为对象类型
        if(typeof(tmpParams) == 'string') {
            try{
                tmpParams = JSON.parse(tmpParams);
            }catch(e) {
                tmpParams = {};
            }
        }

        // 分类请求
        tmpParams['page_size'] = this.pageSize;
        tmpParams['page'] = (params.offset / this.pageSize) + 1;

        _queryParams.params = JSON.stringify(tmpParams);
        return _queryParams;
    }

    /**
     * 初始化表格部分HTML
     */
    initTableHtml() {

        let tableSelector = this.selector + ' .' + this._ContainerClass + ' .' + this._TableClass;

        // 初始化表头
        let theadHtml = `
        <tr>
            <td class="td-checkbox">
                <div>
                <input type="checkbox" name="all" class="${this._TableAllCheckboxClass}">
                </td>
            </td>`;

        if(this.columns instanceof Array && this.columns.length > 0) {
            this.columns.forEach((v) => {
                let style = "";
                if(v.hasOwnProperty('width')) {
                    style = 'width:' + v.width + 'px';
                }
                theadHtml += `<td field="${v['field']}" style="${style}">${v['title']}</td>`;
            });
        }
        theadHtml += '</tr>';
        $(tableSelector + ' > thead').html(theadHtml);

        if(this.apiUrl) {
            this.syncGetApiData()
        } else {
            $(tableSelector + ' > tbody').append(this._LoadingHtml);

            if(JSON.stringify(this.data) != "{}") {
                this.renderTableData(this.data);
                $(tableSelector + ' .sc-table-loading').remove();
            } else {
                $(tableSelector + ' > tbody .sc-table-loading').html('暂无数据');
            }
        }
    }

    /**
     * 默认选中项
     */
    initDefaultSelected() {
        const oldThis = this;

        try{
            Array.from(this.selected).forEach((pk) => {
                oldThis.setSelectStatus(pk, true);
            });
            this.renderSelected();
        }catch(e) {

        }

    }

    /**
     * 格式化接口响应回调方法
     *
     * @param {*} response
     */
    formatApiCallback(response) {
        // 这里进行页面数递增

        if(response.code == 0) {
            // 获取响应数据
            let responseData = response.data.list || [];

            // 渲染新获取到的数据
            this.renderTableData(responseData);

            // 必须有数据才允许递增
            responseData.length > 0 && this._Page ++;

        }

        // 加载失败
        return ;
    }

    /**
     * 接口获取数据出错
     *
     * @param {*} errs
     */
    syncGetApiDataErrorCallback(errs) {
        let tableSelector = this.selector + ' .' + this._ContainerClass + ' .' + this._TableClass;
        let html = '<div class="sc-table-loading">无法载入数据...</div>';
        $(tableSelector + ' > tbody').append(html)
    }

    /**
     * 获取异步请求参数
     */
    getApiQueryParams() {
        let http_build_query = function(params, sep = '&', toType = 'url') {
            let queryStr = '';
            let queryJson = {};

            for(let key in params) {
                let v = params[key];

                if(typeof(v) == 'object') {
                    v = JSON.stringify(http_build_query(v, sep, 'json'));
                }

                queryStr +=  key + '=' + v + sep;
                queryJson[key] = v;
            }


            return toType == 'url' ? queryStr.substr(0, queryStr.length - 1) : queryJson;
        }

        let params = this.queryParams || {};

        // 设置分页参数
        params['params']['page_size'] = this._PageSize;
        params['params']['page'] = this._Page;


        return this.apiUrl + '?' + http_build_query(params) ;
    }

    /**
     * 异步获取数据
     */
    syncGetApiData() {

        if (!this.apiUrl) {
            return this.data;
        }

        const oldThis = this;

        let tableSelector = this.selector + ' .' + this._ContainerClass + ' .' + this._TableClass;
        $(tableSelector + ' > tbody').append('<div class="append-data">' + this._LoadingHtml + '</div>');

        $.ajax({
            type: 'GET',
            url: this.getApiQueryParams(),
            dataType: 'json',
            success: function (res) {
                oldThis.formatApiCallback(res);
                oldThis._Loading = false;
                $(tableSelector+' .sc-table-loading').remove();
                $(tableSelector+' .append-data').remove();
            },
            error: function (errs) {
                oldThis.syncGetApiDataErrorCallback(errs);
                oldThis._Loading = false;
            }
        });

    }

    /**
     * 渲染表格数据
     *
     * @param {*} data
     */
    renderTableData(data, isSearch = false) {
        let oldThis = this;
        let tableSelector = this.selector + ' .' + this._ContainerClass + ' .' + this._TableClass;
``
        // 表格滚动到底部事件
        let row = '';
        for(let key in data){
            let item = data[key];
            let pk = item[oldThis._PkName];
            !isSearch && (oldThis.data[pk] = item);
            row += `
            <tr>
                <td class="td-checkbox">
                <div>
                    <input type="checkbox" name="row" pk="${pk}" class="${this._TableRowCheckboxClass}">
                </div>
                </td>`;
            if(oldThis.columns instanceof Array && oldThis.columns.length > 0) {
                oldThis.columns.forEach((v) => {
                    try{
                        let style = "";
                        if(v.hasOwnProperty('width')) {
                            style = 'width:' + v.width + 'px';
                        }
                        row += `<td style="${style}">${item[v.field]}</td>`;
                    }catch(e){
                        row += '<td style=""></td>';
                    }
                });
            }
            row += '</tr>';
        }
        isSearch ? $(tableSelector + ' > tbody').html(row) : $(tableSelector + ' > tbody').append(row);

        // 保存缓存数据
        this.listenTrRowClickEvent();
        this.calcAllSelectStatus();
        this.emptyTableHtml();
    }

    /**
     * 设置选择状态
     *
     * @param {*} id
     * @param {*} status
     */
    setSelectStatus(id, status = true) {
        $(this.selector + ' input[type="checkbox"][pk="'+id+'"]').prop('checked', status);

        if (status) {
            this.selected.add(id);
            this.value[id] = this.data[id];
        } else {
            this.selected.delete(id);
            delete this.value[id];
        }
    }

    /**
     * 设置根节点值属性
     */
    setValueAttribute() {
        $(this.selector).attr('value', JSON.stringify(Array.from(this.selected)));
    }

    /**
     * 渲染已选操作
     */
    renderSelected() {
        // 设置节点值
        this.setValueAttribute();
        // 每次操作均会重新渲染一遍label面板
        this.renderSelectedLable();
    }

    /**
     * 渲染已选标签列表
     */
    renderSelectedLable() {
        let oldThis = this;
        let labelsDom = $(this.selector + ' .' + this._HeaderClass + ' .'+this._HeaderLablesClass);

        labelsDom.html('');

        let labelHtml = '';
        for(let k in this.value) {
            let v = this.value[k];
            labelHtml += `<label value="${v[oldThis._PkName]}">
                    ${v[oldThis._TitleName]} 
                    <div class="${oldThis._LabelCloseClass}" title="关闭" value="${v[oldThis._PkName]}"></div>
                </label>`;
        };
        labelsDom.html(labelHtml);

        this.listenLabelCloseEvent();

    }

    /**
     * 监听事件
     */
    listenEvents() {
        this.listenAllSelectedEvent();
        this.listenTbodyScrollEvent();
        this.listenSearchInputEvent();
    }

    /**
     * 全选操作事件
     */
    listenAllSelectedEvent() {
        let tableSelector = this.selector + ' .' + this._ContainerClass  + ' .' + this._TableClass;
        let eventSelector =  tableSelector + ' .' + this._TableAllCheckboxClass  ;
        const oldThis = this;

        $(eventSelector).on('click', function (e) {
            let status = $(this).is(':checked');
            $(tableSelector + ' input[type="checkbox"]').prop('checked', status);

            if (status) {
                // oldThis.value = oldThis.data;
                oldThis.selected = new Set([]);

                for(let k in oldThis.data) {
                    oldThis.selected.add(k);
                    oldThis.value[k] = oldThis.data[k];
                }

                oldThis.renderSelected();
            }


        });
    }

    /**
     * 选中行事件
     */
    listenTrRowClickEvent() {
        let tableBodySelector = this.selector + ' .' + this._ContainerClass  + ' .' + this._TableClass + ' > tbody';
        const oldThis = this;

        $(tableBodySelector + ' tr').on('click', function (e) {
            let rowCheckbox = $(this).find('input[type="checkbox"]');
            let status = rowCheckbox.is(':checkbox');
            oldThis.setSelectStatus(rowCheckbox.attr('pk'), status);
            oldThis.renderSelected();
            oldThis.calcAllSelectStatus();
        });

        $(tableBodySelector + ' tr input[type="checkbox"]').on('click', function (e) {
            e.stopPropagation();
            oldThis.setSelectStatus($(this).attr('pk'), $(this).is(':checked'));
            oldThis.renderSelected();
            oldThis.calcAllSelectStatus();
        });

    }

    /**
     * 滚动到底部事件
     */
    listenTbodyScrollEvent() {
        const oldThis = this;
        // scrollBottomHeight
        let tableSelector = this.selector + ' .' + this._ContainerClass + ' .' + this._TableClass;

        // 表格滚动到底部事件
        $(tableSelector + ' > tbody').on('scroll', function (e) {
            let clientHeight  = $(this)[0].clientHeight;  // 客户区大小
            let scrollHeight  = $(this)[0].scrollHeight;  // 没用滚动条的情况下，元素内容的总高度
            let scrollTop     = $(this)[0].scrollTop;     // 被隐藏在内容区域上方的像素数

            if(
                scrollTop + clientHeight + 50 >= scrollHeight &&
                scrollTop > oldThis._ScrollBtmPointer &&
                !oldThis._Loading
            ) {
                oldThis._Loading = true;
                oldThis.syncGetApiData();
                oldThis._ScrollBtmPointer = scrollTop;
            }

        });
    }

    /**
     * 标签关闭事件
     */
    listenLabelCloseEvent() {
        let _selector = this.selector + ' .' + this._HeaderLablesClass + ' .' + this._LabelCloseClass;
        const oldThis = this;
        $(_selector).on('click', function () {
            let val = $(this).attr('value');
            oldThis.setSelectStatus(val, false);
            oldThis.renderSelected();
        });
    }

    /**
     * 查询事件监听
     */
    listenSearchInputEvent() {
        const oldThis = this;
        let _selector = this.selector + ' .'+this._TableToolPanelClass + ' .'+this._TableSearchClass;
        $(_selector).on('input', function (e) {
            let val = $(this).val();
            let tmpData = {};

            if (val) {

                for(let key in oldThis.data) {
                    let item = oldThis.data[key];

                    if(item[oldThis._TitleName].indexOf(val) != -1) {
                        tmpData[item[oldThis._PkName]] = item;
                    }

                }

                oldThis._Loading = true;

            } else {
                tmpData = oldThis.data;
                oldThis._Loading = false;
            }

            oldThis.renderTableData(tmpData, true);
        });
    }

    /**
     * 计算全选状态
     */
    calcAllSelectStatus(){
        // 获取全选复选框状态
        let allCheckbox = $(this.selector + ' .'+this._TableAllCheckboxClass);

        if ($(this.selector + ' input[type="checkbox"]:not([name="all"])').length == Array.from(this.selected).length) {
            allCheckbox.prop('checked', true);
        } else {
            allCheckbox.prop('checked', false);
        }

    }

    /**
     * 空数据显示
     */
    emptyTableHtml() {
        let tableSelector = this.selector + ' .' + this._ContainerClass + ' .' + this._TableClass;

        let content = $(tableSelector + ' > table').text();
        console.log(content);
        if (!content || content.replace(' ', '') == '') {
            $(tableSelector + ' > tbody').html('<div class="not-data">暂无数据</div>')
        }
    }
}

