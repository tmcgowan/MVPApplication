
const MVPHelp = {
    'text': '<p class="lead">Purpose</p><p>The MVP visualization tool extends Galaxy-P\'s advantages into the ' +
    'visualization of large, complex data sets. This allows researchers to quickly inspect and verify the quality ' +
    'of the results as well offer an overview with visualization and a deeper understanding of underlying spectral data. ' +
    ' This can be especially valuable when results include inputs from possibly diverse domains.</p>' + '' +
    '<p>With the incorporation of Integrated Genomics Viewer (IGV) and Lorikeet, the MVP platform is already merging ' +
    'proteomic and genomic results into a single, accessible output. A user can, with relatively few keystrokes, ' +
    'filter and order large datasets down to a manageable subset. Due to the tools use of server-side caching, ' +
    'large data sets are handled as quickly as small datasets.</p>' +
    '<p>You are first presented with an overview of peptide sequences identified in the MZSqlite input. From here, you can find ' +
    '<ul><li>PSMs linked to specific peptide sequences</li><li>PSMs based on score filtering</li>' +
    '<li>MSMS spectra used in the PSM identification</li><li>Mapping PSMs to the protein, and then mapping the protein to the genomic seqeunce.</li>' +
    '<li>Save PSM details from curated MSMS scans back to the current Galaxy history</li></ul></p>' +
    '<hr><p class="lead">Actions</p><p><dl>' +
    '<dt>ID Scores</dt><dd>Distribution of spectral matching identification scores</dd>' +
    '<dt>ID Features</dt><dd>Select identification features for display</dd>' +
    '<dt>Export Scans</dt><dd>Exports list of verified PSMs to active history</dd>'

};


/**
 * Mediator pattern as main application.
 */
var MVPApplication = (function (app) {
    app.debug = false; //Listen in on event publish
    app.galaxyConfiguration = {};
    app.events = {};
    app.userDefaults = null;

    //Hold some basic defaults. User can override.
    app.app_defaults = {
        "tool_tip_visible": true
    };

    /**
     * Allows objects to subscribe to an event.
     * @param event name
     * @param fn call back function for event
     * @returns {subscribe}
     */
    app.subscribe = function (event, fn) {
        if (!app.events[event]) {
            app.events[event] = [];
        }
        app.events[event].push({
            context: this,
            callback: fn
        });
        return this;
    };

    /**
     * Unsubscribes from the event queue
     * @param event
     * @param fn
     */
    app.unsubscribe = function (event) {
        app.event[event].filter(function (cv) {
            return this === cv.context;
        }.bind(this));
    };


    /**
     * Allows objects to broadcast the occurrence of an event.
     * All subscribers to the event will have their callback functions
     * called.
     *
     * @param event name
     * @returns {*}
     */
    app.publish = function (event) {
        var args, subscription;

        if (!app.events[event]) {
            return false;
        }
        args = Array.prototype.slice.call(arguments, 1);

        if (app.debug) {
            console.log('APP PUBLISH: ' + event + ' ARGS: ' + args);
        }

        app.events[event].map(function (cv) {
            subscription = cv;
            subscription.callback.apply(subscription.context, args);
        });
        return this;
    };

    /**
     * Adds the subscribe and publish functions to an object
     * @param obj
     */
    app.installTo = function (obj) {
        obj.subscribe = app.subscribe;
        obj.publish = app.publish;
        obj.unsubscribe = app.unsubscribe;
    };

    //Load modules
    app.init = function (confObj) {
        this.galaxyConfiguration = confObj;

        $('#dataset_name').text(this.galaxyConfiguration.dataName);

        this.subscribe("ScoreSummaryComplete", function(){
           console.log('Score summary complete, begin table construction');
           ScoreDefaults.init();
           PeptideView.init({
                galaxyConfiguration: this.galaxyConfiguration,
                baseDiv: 'overview_div'
            });

        });

        this.subscribe("FDRDataPrepared", function(){
            $('#fdr_module').removeAttr('disabled')
                .on('click', function(){
                    $('#fdr_div').toggle();
                    $('html, body').animate({
                        scrollTop: ($('#fdr_div').offset().top)
                    },500);
                    $('#fdr_module').tooltip('hide')
                });

        });

        this.subscribe('UserChangedDefaults', function(data){
            Object.keys(data).forEach(function(k){
                console.log('UserChangedDefaults ' + k + " : " + data[k]);
                app.app_defaults[k] = data[k];
                if (k === 'tool_tip_visible') {
                    if (data[k]) {
                        $('[data-toggle="tooltip"]').tooltip();
                    } else {
                        $('[data-toggle="tooltip"]').tooltip('destroy');
                    }
                }

            });
        });

        this.installTo(ScoreSummary);
        this.installTo(PeptideView);
        this.installTo(RenderPSM);
        this.installTo(VerifiedScans);
        this.installTo(PeptideSequenceFilter);
        this.installTo(featureViewer);
        this.installTo(gQuery);
        this.installTo(ScoreDefaults);
        this.installTo(FDRPresentation);
        this.installTo(ScoreFilterModule);
        this.installTo(IGVManager);
        this.installTo(IGVTrackManager);
        this.installTo(BuildHelpPanel);
        this.installTo(ConfigModal);

        ScoreFilterModule.init({});

        gQuery.init({
            href: this.galaxyConfiguration.href,
            datasetID: this.galaxyConfiguration.datasetID
        });

        featureViewer.init({
            galaxyConfiguration: this.galaxyConfiguration,
            baseDiv: 'protein_viewer',
            queryFunc: gQuery.query,
            dbkey: this.galaxyConfiguration.dbkey
        });

        RenderPSM.init({
            galaxyConfiguration: this.galaxyConfiguration
        });


        VerifiedScans.init({
            galaxyConfiguration: this.galaxyConfiguration
        });

        PeptideSequenceFilter.init({
            galaxyConfiguration: this.galaxyConfiguration
        });

        ScoreSummary.init({
            href: this.galaxyConfiguration.href,
            datasetID: this.galaxyConfiguration.datasetID
        });

        IGVManager.init({
            galaxyConfiguration: this.galaxyConfiguration
        });

        IGVTrackManager.init({
           galaxyConfiguration: this.galaxyConfiguration
        });

        if (("protein_detection_protocol" in confObj.tableRowCount)){
            FDRPresentation.init({
                href: this.galaxyConfiguration.href,
                datasetID: this.galaxyConfiguration.datasetID,
                divID: "fdr_div",
                callBackFN: PeptideView.reBuildTable
            });
        }
        $('[data-toggle="tooltip"]').tooltip();

        $('#mvp_help').on('click', function(){
            BuildHelpPanel.showHelp(MVPHelp.text);
        });

        $('#mvp_config').on('click', function(){
           ConfigModal.showConfig();
        });
    };

    return {
        run: function(confbj) {
            app.init(confbj);
        }
    }

}(MVPApplication || {})); // eslint-disable-line no-use-before-define